import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ClothingItemDto } from '../types/api';
import { useTheme } from '../theme';

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

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: pressed ? theme.colors.cardPressed : theme.colors.card,
          borderRadius: theme.radius.md,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <Image
        source={item.processedImageUrl ?? item.originalImageUrl}
        style={[styles.image, { backgroundColor: theme.colors.cardPressed }]}
        // Cutouts (background removed) float on the card; raw photos fill it
        contentFit={item.processedImageUrl ? 'contain' : 'cover'}
        transition={150}
      />
      {item.isFavorite && <Text style={styles.favorite}>♥</Text>}
      <View style={styles.meta}>
        <Text numberOfLines={1} style={[theme.text.label, { color: theme.colors.text }]}>
          {label}
        </Text>
        <Text style={[theme.text.caption, { color: theme.colors.textMuted }]}>
          {item.primaryColor ?? '—'} · worn {item.wearCount}×
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, borderWidth: 1, overflow: 'hidden', margin: 6 },
  image: { width: '100%', aspectRatio: 0.85 },
  favorite: { position: 'absolute', top: 8, right: 10, fontSize: 16, color: '#E0564A' },
  meta: { padding: 10, gap: 2 },
});
