import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDeleteItem, useItem, useUpdateItem } from '../../api/hooks';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { CONTENT_MAX_WIDTH, useTheme } from '../../theme';
import type { ClothingCategory } from '../../types/api';

const CATEGORIES: ClothingCategory[] = [
  'TOP',
  'BOTTOM',
  'DRESS',
  'OUTERWEAR',
  'SHOES',
  'ACCESSORY',
  'BAG',
];

export default function ItemDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: item, isLoading } = useItem(id);
  const update = useUpdateItem(id);
  const remove = useDeleteItem();

  if (isLoading || !item) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  const neverWorn = !item.lastWornDate;

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
    >
      <View style={{ width: '100%', maxWidth: CONTENT_MAX_WIDTH, gap: 16 }}>
        <Image
          source={item.processedImageUrl ?? item.originalImageUrl}
          style={[
            styles.image,
            { backgroundColor: theme.colors.card, borderRadius: theme.radius.lg },
          ]}
          contentFit="contain"
        />

        <View style={styles.statsRow}>
          <Stat label="Worn" value={`${item.wearCount}×`} />
          <Stat
            label="Last worn"
            value={neverWorn ? 'Never' : item.lastWornDate!.slice(0, 10)}
          />
          <Stat label="Color" value={item.primaryColor ?? '—'} />
          {item.aiConfidence != null && item.aiConfidence > 0 && (
            <Stat label="AI confidence" value={`${Math.round(item.aiConfidence * 100)}%`} />
          )}
        </View>

        <Text style={[theme.text.heading, { color: theme.colors.text }]}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {CATEGORIES.map((cat) => (
            <Chip
              key={cat}
              label={cat.charAt(0) + cat.slice(1).toLowerCase()}
              selected={item.category === cat}
              onPress={() => update.mutate({ category: cat })}
            />
          ))}
        </ScrollView>

        <Button
          title={item.isFavorite ? '♥ Remove from favorites' : '♡ Mark as favorite'}
          variant="secondary"
          onPress={() => update.mutate({ isFavorite: !item.isFavorite })}
        />
        <Button
          title={item.isArchived ? 'Restore to closet' : 'Archive (declutter)'}
          variant="secondary"
          onPress={() => update.mutate({ isArchived: !item.isArchived })}
        />
        <Button
          title="Delete item"
          variant="danger"
          onPress={() => {
            remove.mutate(item.id, { onSuccess: () => router.back() });
          }}
        />
      </View>
    </ScrollView>
  );

  function Stat({ label, value }: { label: string; value: string }) {
    return (
      <View
        style={[
          styles.stat,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.sm,
          },
        ]}
      >
        <Text style={[theme.text.caption, { color: theme.colors.textMuted }]}>{label}</Text>
        <Text style={[theme.text.label, { color: theme.colors.text }]}>{value}</Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, alignItems: 'center' },
  image: { width: '100%', aspectRatio: 0.9 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
});
