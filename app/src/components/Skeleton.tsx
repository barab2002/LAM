import React, { useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../theme';

interface SkeletonProps {
  style?: ViewStyle;
  radius?: number;
}

/** A single pulsing placeholder block. */
export function Skeleton({ style, radius }: SkeletonProps) {
  const theme = useTheme();
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.5, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        styles.base,
        {
          backgroundColor: theme.colors.surfaceSunken,
          borderRadius: radius ?? theme.radius.md,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

/** A skeleton stand-in shaped like an OutfitCard while suggestions load. */
export function OutfitCardSkeleton() {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radius.lg },
      ]}
    >
      <View style={styles.imagesRow}>
        <Skeleton style={styles.image} />
        <Skeleton style={styles.image} />
      </View>
      <Skeleton style={{ width: '60%', height: 14 }} radius={999} />
      <Skeleton style={{ width: '40%', height: 14 }} radius={999} />
    </View>
  );
}

/** Skeleton stand-in shaped like an ItemCard, for the closet grid while loading. */
export function ItemCardSkeleton() {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.itemCard,
        { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radius.md },
      ]}
    >
      <Skeleton style={styles.itemImage} radius={0} />
      <View style={{ padding: 10, gap: 6 }}>
        <Skeleton style={{ width: '70%', height: 12 }} radius={999} />
        <Skeleton style={{ width: '45%', height: 11 }} radius={999} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
  card: { borderWidth: 1, padding: 18, gap: 14 },
  imagesRow: { flexDirection: 'row', gap: 8 },
  image: { flex: 1, aspectRatio: 0.9, borderRadius: 12 },
  itemCard: { flex: 1, margin: 6, borderWidth: 1, overflow: 'hidden' },
  itemImage: { width: '100%', aspectRatio: 0.85 },
});
