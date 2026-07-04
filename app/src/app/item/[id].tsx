import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  useCreateLook,
  useDeleteItem,
  useItem,
  useItemPairings,
  useLooks,
  useUpdateItem,
} from '../../api/hooks';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { CONTENT_MAX_WIDTH, useTheme } from '../../theme';
import type { ClothingCategory, SuggestedLookDto } from '../../types/api';

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
  const { data: pairings, isLoading: pairingsLoading } = useItemPairings(id);
  const { data: looksWithItem } = useLooks(id);
  const createLook = useCreateLook();

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

        <Text style={[theme.text.heading, { color: theme.colors.text }]}>
          ✨ Best to go with
        </Text>
        {pairingsLoading && <ActivityIndicator color={theme.colors.accent} />}
        {!pairingsLoading && (pairings?.length ?? 0) === 0 && (
          <Text style={[theme.text.caption, { color: theme.colors.textMuted }]}>
            Add a few more pieces (tops, bottoms, shoes) and LAM will suggest what pairs
            with this one.
          </Text>
        )}
        {pairings && pairings.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {pairings.map((pairing, idx) => (
              <PairingCard key={idx} pairing={pairing} anchorId={item.id} />
            ))}
          </ScrollView>
        )}

        {looksWithItem && looksWithItem.length > 0 && (
          <>
            <Text style={[theme.text.heading, { color: theme.colors.text }]}>
              👗 Looks with this item
            </Text>
            {looksWithItem.map((look) => (
              <View
                key={look.id}
                style={[
                  styles.lookRow,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radius.md,
                  },
                ]}
              >
                <Text style={[theme.text.label, { color: theme.colors.text }]}>
                  {look.name ?? 'Saved look'}
                </Text>
                <View style={styles.lookImages}>
                  {look.items.map((li) => (
                    <Image
                      key={li.id}
                      source={li.processedImageUrl ?? li.originalImageUrl}
                      style={[styles.lookThumb, { backgroundColor: theme.colors.cardPressed }]}
                      contentFit="contain"
                    />
                  ))}
                </View>
              </View>
            ))}
          </>
        )}

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

  function PairingCard({ pairing, anchorId }: { pairing: SuggestedLookDto; anchorId: string }) {
    const partners = pairing.items.filter((p) => p.id !== anchorId);
    const comboKey = pairing.items.map((p) => p.id).sort().join(',');
    const savedKey = createLook.isSuccess
      ? [...(createLook.variables?.itemIds ?? [])].sort().join(',')
      : null;
    const saved = savedKey === comboKey;
    return (
      <View
        style={[
          styles.pairing,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.md,
          },
        ]}
      >
        <View style={styles.pairingImages}>
          {partners.slice(0, 3).map((partner) => (
            <Pressable key={partner.id} onPress={() => router.push(`/item/${partner.id}`)}>
              <Image
                source={partner.processedImageUrl ?? partner.originalImageUrl}
                style={[styles.pairingThumb, { backgroundColor: theme.colors.cardPressed }]}
                contentFit="contain"
              />
            </Pressable>
          ))}
        </View>
        <Text
          numberOfLines={1}
          style={[theme.text.caption, { color: theme.colors.textMuted, maxWidth: 170 }]}
        >
          {partners.map((p) => p.name ?? p.subcategory ?? p.category.toLowerCase()).join(' + ')}
        </Text>
        {pairing.reasons[0] && (
          <Text
            numberOfLines={1}
            style={[theme.text.caption, { color: theme.colors.accent, maxWidth: 170 }]}
          >
            {pairing.reasons[0]}
          </Text>
        )}
        <Button
          title={saved ? 'Saved ✓' : 'Save as look'}
          variant="secondary"
          compact
          onPress={() =>
            createLook.mutate({ itemIds: pairing.items.map((p) => p.id) })
          }
        />
      </View>
    );
  }

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
  pairing: { borderWidth: 1, padding: 10, gap: 6, marginRight: 10, width: 190 },
  pairingImages: { flexDirection: 'row', gap: 6 },
  pairingThumb: { width: 52, height: 64, borderRadius: 8 },
  lookRow: { borderWidth: 1, padding: 12, gap: 8 },
  lookImages: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  lookThumb: { width: 48, height: 58, borderRadius: 8 },
});
