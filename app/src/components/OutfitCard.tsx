import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { SuggestedLookDto } from '../types/api';
import { fonts, useTheme } from '../theme';

interface OutfitCardProps {
  suggestion: SuggestedLookDto;
  /** Swipe right / like */
  onLike: () => void;
  /** Swipe left / dislike */
  onDislike: () => void;
}

const SWIPE_THRESHOLD = 110;

/**
 * A/B rating card: swipe right to like, left to pass (arrow buttons on the
 * screen call the same handlers for web/accessibility).
 */
export function OutfitCard({ suggestion, onLike, onDislike }: OutfitCardProps) {
  const theme = useTheme();
  const translateX = useSharedValue(0);
  const items = suggestion.items;

  const pan = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd(() => {
      if (translateX.value > SWIPE_THRESHOLD) {
        translateX.value = withTiming(500, { duration: 180 });
        runOnJS(onLike)();
      } else if (translateX.value < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(-500, { duration: 180 });
        runOnJS(onDislike)();
      } else {
        translateX.value = withSpring(0);
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { rotateZ: `${translateX.value / 22}deg` },
    ],
  }));

  const likeStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, translateX.value / SWIPE_THRESHOLD)),
  }));
  const nopeStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, -translateX.value / SWIPE_THRESHOLD)),
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          styles.card,
          theme.shadow('md'),
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.lg,
          },
          cardStyle,
        ]}
      >
        <View style={styles.imagesRow}>
          {items.slice(0, 4).map((item) => (
            <Image
              key={item.id}
              source={item.processedImageUrl ?? item.originalImageUrl}
              style={[
                styles.itemImage,
                { backgroundColor: theme.colors.surfaceSunken, borderRadius: theme.radius.sm },
                items.length === 1 && { flexBasis: '100%' },
              ]}
              contentFit="contain"
            />
          ))}
        </View>

        <View style={styles.reasonsWrap}>
          {suggestion.reasons.map((reason) => (
            <View
              key={reason}
              style={[
                styles.reason,
                { backgroundColor: theme.colors.accentMuted, borderRadius: theme.radius.full },
              ]}
            >
              <Text style={[theme.text.caption, { color: theme.colors.text }]}>{reason}</Text>
            </View>
          ))}
        </View>

        <Animated.View
          style={[styles.stamp, { borderColor: theme.colors.positive, left: 18 }, likeStyle]}
        >
          <Text style={[styles.stampText, { color: theme.colors.positive }]}>LOVE IT</Text>
        </Animated.View>
        <Animated.View
          style={[
            styles.stamp,
            { borderColor: theme.colors.danger, right: 18, transform: [{ rotateZ: '8deg' }] },
            nopeStyle,
          ]}
        >
          <Text style={[styles.stampText, { color: theme.colors.danger }]}>PASS</Text>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, padding: 18, gap: 14 },
  imagesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  itemImage: { flexGrow: 1, flexBasis: '45%', aspectRatio: 0.9 },
  reasonsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  reason: { paddingHorizontal: 12, paddingVertical: 6 },
  stamp: {
    position: 'absolute',
    top: 18,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderRadius: 6,
    transform: [{ rotateZ: '-8deg' }],
  },
  stampText: { fontSize: 13, fontFamily: fonts.bold, letterSpacing: 2 },
});
