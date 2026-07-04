import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useRating } from '../../api/hooks';
import { CONTENT_MAX_WIDTH, fonts, motion, Theme, useTheme } from '../../theme';
import type { PersonaReactionDto } from '../../types/api';

function scoreColor(theme: Theme, score: number): string {
  if (score >= 80) return theme.colors.positive;
  if (score >= 65) return theme.colors.accent;
  if (score >= 50) return '#C4884B';
  return theme.colors.danger;
}

/** Counts a number up from 0 to `value` on mount — a small delight moment. */
function useCountUp(value: number, durationMs = 700): number {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let raf: number;
    const start = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / durationMs);
      setDisplay(Math.round(value * (1 - Math.pow(1 - t, 3)))); // ease-out cubic
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);
  return display;
}

function PersonaCard({ persona }: { persona: PersonaReactionDto }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.persona,
        theme.shadow('sm'),
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.lg,
        },
      ]}
    >
      <View style={styles.personaHeader}>
        <View style={[styles.personaAvatar, { backgroundColor: theme.colors.accentMuted }]}>
          <Text style={styles.personaEmoji}>{persona.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[theme.text.label, { color: theme.colors.text }]}>{persona.name}</Text>
          <Text style={[theme.text.caption, { color: theme.colors.textMuted }]}>
            {persona.role}
          </Text>
        </View>
        <Text style={[theme.text.heading, { color: scoreColor(theme, persona.score) }]}>
          {persona.score}
        </Text>
      </View>
      <Text style={[theme.text.body, { color: theme.colors.text }]}>“{persona.comment}”</Text>
      {persona.reply ? (
        <View
          style={[
            styles.reply,
            { borderLeftColor: theme.colors.accent, backgroundColor: theme.colors.surfaceSunken },
          ]}
        >
          <Text style={[theme.text.caption, { color: theme.colors.textMuted }]}>
            after hearing the panel · “{persona.reply}”
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default function RatingScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: rating, isLoading } = useRating(id);
  const ringOpacity = useSharedValue(0);
  const ringScale = useSharedValue(0.85);

  useEffect(() => {
    if (rating) {
      ringOpacity.value = withTiming(1, { duration: motion.duration.slow, easing: motion.easing });
      ringScale.value = withTiming(1, { duration: motion.duration.slow, easing: motion.easing });
    }
  }, [rating, ringOpacity, ringScale]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));

  // Hooks must run unconditionally — count up from 0 even before data resolves.
  const displayScore = useCountUp(rating?.overallScore ?? 0);

  if (isLoading || !rating) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  const ring = scoreColor(theme, rating.overallScore);

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
    >
      <View style={{ width: '100%', maxWidth: CONTENT_MAX_WIDTH, gap: 14 }}>
        <View style={styles.scoreWrap}>
          <Animated.View
            style={[
              styles.scoreRing,
              theme.shadow('md'),
              { borderColor: ring, backgroundColor: theme.colors.card },
              ringStyle,
            ]}
          >
            <Text style={[styles.scoreNumber, { color: ring, fontFamily: fonts.extrabold }]}>
              {displayScore}
            </Text>
            <Text style={[theme.text.caption, { color: theme.colors.textMuted }]}>/ 100</Text>
          </Animated.View>
        </View>

        <Text style={[theme.text.heading, { color: theme.colors.text, textAlign: 'center' }]}>
          {rating.verdict}
        </Text>

        {rating.source === 'HEURISTIC' && (
          <View
            style={[
              styles.badge,
              { backgroundColor: theme.colors.accentMuted, alignSelf: 'center' },
            ]}
          >
            <Text style={[theme.text.caption, { color: theme.colors.text }]}>
              ⚙️ Offline jury — connect an LLM backend for live opinions (see README)
            </Text>
          </View>
        )}

        <Text style={[theme.text.label, { color: theme.colors.textMuted, marginTop: 8 }]}>
          THE PANEL · {rating.personas.length} voices
        </Text>
        {rating.personas.map((persona) => (
          <PersonaCard key={persona.name} persona={persona} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, alignItems: 'center', paddingBottom: 48 },
  scoreWrap: { alignItems: 'center', marginTop: 8 },
  scoreRing: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNumber: { fontSize: 46 },
  badge: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  persona: { borderWidth: 1, padding: 16, gap: 10 },
  personaHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  personaAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personaEmoji: { fontSize: 20 },
  reply: { borderLeftWidth: 3, padding: 8, borderRadius: 6 },
});
