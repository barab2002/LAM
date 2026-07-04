import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRating } from '../../api/hooks';
import { CONTENT_MAX_WIDTH, useTheme } from '../../theme';
import type { PersonaReactionDto } from '../../types/api';

function scoreColor(score: number): string {
  if (score >= 80) return '#3E7C4F';
  if (score >= 65) return '#8A8A2E';
  if (score >= 50) return '#C4884B';
  return '#B3402E';
}

function PersonaCard({ persona }: { persona: PersonaReactionDto }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.persona,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
        },
      ]}
    >
      <View style={styles.personaHeader}>
        <Text style={styles.personaEmoji}>{persona.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[theme.text.label, { color: theme.colors.text }]}>{persona.name}</Text>
          <Text style={[theme.text.caption, { color: theme.colors.textMuted }]}>
            {persona.role}
          </Text>
        </View>
        <Text style={[theme.text.heading, { color: scoreColor(persona.score) }]}>
          {persona.score}
        </Text>
      </View>
      <Text style={[theme.text.body, { color: theme.colors.text }]}>“{persona.comment}”</Text>
      {persona.reply ? (
        <View
          style={[
            styles.reply,
            { borderLeftColor: theme.colors.accent, backgroundColor: theme.colors.cardPressed },
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

  if (isLoading || !rating) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  const ring = scoreColor(rating.overallScore);

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
    >
      <View style={{ width: '100%', maxWidth: CONTENT_MAX_WIDTH, gap: 14 }}>
        <View style={styles.scoreWrap}>
          <View style={[styles.scoreRing, { borderColor: ring, backgroundColor: theme.colors.card }]}>
            <Text style={[styles.scoreNumber, { color: ring }]}>{rating.overallScore}</Text>
            <Text style={[theme.text.caption, { color: theme.colors.textMuted }]}>/ 100</Text>
          </View>
        </View>

        <Text style={[theme.text.heading, { color: theme.colors.text, textAlign: 'center' }]}>
          {rating.verdict}
        </Text>

        {rating.source === 'HEURISTIC' && (
          <Text
            style={[
              theme.text.caption,
              {
                color: theme.colors.textMuted,
                textAlign: 'center',
              },
            ]}
          >
            ⚙️ Offline jury (rule-based). Connect an LLM backend for live persona opinions —
            see README.
          </Text>
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
  scoreNumber: { fontSize: 46, fontWeight: '800' },
  persona: { borderWidth: 1, padding: 14, gap: 8 },
  personaHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  personaEmoji: { fontSize: 26 },
  reply: { borderLeftWidth: 3, padding: 8, borderRadius: 6 },
});
