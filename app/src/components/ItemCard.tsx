import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { ClothingItemDto } from '../types/api';
import { Icon } from './Icon';
import { motion, useTheme } from '../theme';

interface ItemCardProps {
  item: ClothingItemDto;
  onPress?: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  TOP: 'Top',
  BOTTOM: 'Bottom',
  DRESS: 'Dress',
  OUTERWEAR: 'Outerwear',
  SHOES: 'Shoes',
  ACCESSORY: 'Accessory',
  BAG: 'Bag',
};

export function ItemCard({ item, onPress }: ItemCardProps) {
  const theme = useTheme();
  const label = item.name || item.subcategory || CATEGORY_LABELS[item.category] || 'Item';
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    // Shadow lives on this outer view — a sibling `overflow: hidden` (for the
    // image's rounded corners) on the same layer would otherwise clip it invisible.
    <Animated.View style={[styles.wrap, theme.shadow('sm'), animatedStyle]}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        onPressIn={() => {
          scale.value = withTiming(0.97, { duration: motion.duration.fast });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: motion.duration.fast });
        }}
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.card,
            borderRadius: theme.radius.md,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Image
          source={item.processedImageUrl ?? item.originalImageUrl}
          style={[styles.image, { backgroundColor: theme.colors.surfaceSunken }]}
          // Cutouts (background removed) float on the card; raw photos fill it
          contentFit={item.processedImageUrl ? 'contain' : 'cover'}
          transition={150}
        />
        {item.isFavorite && (
          <BlurView intensity={40} tint="light" style={styles.favoriteBadge}>
            <Icon name="heart" size={14} color={theme.colors.danger} />
          </BlurView>
        )}
        <View style={styles.meta}>
          <Text numberOfLines={1} style={[theme.text.label, { color: theme.colors.text }]}>
            {label}
          </Text>
          <Text style={[theme.text.caption, { color: theme.colors.textMuted }]}>
            {item.primaryColor ?? '—'} · worn {item.wearCount}×
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, margin: 6 },
  card: { borderWidth: 1, overflow: 'hidden' },
  image: { width: '100%', aspectRatio: 0.85 },
  favoriteBadge: {
    position: 'absolute',
    top: 8,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  meta: { padding: 10, gap: 2 },
});
