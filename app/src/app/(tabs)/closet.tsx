import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDeclutter, useItems, useUploadItem } from '../../api/hooks';
import { EmptyState } from '../../components/EmptyState';
import { Chip } from '../../components/Chip';
import { ItemCard } from '../../components/ItemCard';
import { CONTENT_MAX_WIDTH, useTheme } from '../../theme';

const CATEGORY_FILTERS = [
  { label: 'All', value: undefined },
  { label: 'Tops', value: 'TOP' },
  { label: 'Bottoms', value: 'BOTTOM' },
  { label: 'Dresses', value: 'DRESS' },
  { label: 'Outerwear', value: 'OUTERWEAR' },
  { label: 'Shoes', value: 'SHOES' },
  { label: 'Bags', value: 'BAG' },
  { label: 'Accessories', value: 'ACCESSORY' },
] as const;

export default function ClosetScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [category, setCategory] = useState<string | undefined>();
  const [showDeclutter, setShowDeclutter] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  const { data: items, isLoading } = useItems({ category });
  const { data: declutter } = useDeclutter();
  const upload = useUploadItem();

  const pickFromGallery = async () => {
    setAddOpen(false);
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    const asset = picked.assets?.[0];
    if (!asset) return;
    const form = new FormData();
    if (asset.uri.startsWith('data:') || asset.uri.startsWith('blob:')) {
      // Web returns data/blob URIs — convert to a Blob for upload
      const blob = await (await fetch(asset.uri)).blob();
      form.append('image', blob, asset.fileName ?? 'garment.jpg');
    } else {
      form.append('image', {
        uri: asset.uri,
        name: asset.fileName ?? 'garment.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      } as unknown as Blob);
    }
    await upload.mutateAsync(form);
  };

  // 2 columns on phones; 3-4 as the (web) viewport widens
  const columns = width >= 1100 ? 4 : width >= 760 ? 3 : 2;

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.column, { maxWidth: width >= 760 ? 1200 : CONTENT_MAX_WIDTH }]}>
        <FlatList
          key={columns}
          data={items ?? []}
          numColumns={columns}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 14 }}
          ListHeaderComponent={
            <View style={{ paddingTop: insets.top + 12, gap: 12 }}>
              <Text style={[theme.text.title, { color: theme.colors.text }]}>Closet</Text>

              {declutter && declutter.length > 0 && showDeclutter && (
                <Pressable
                  onPress={() => setShowDeclutter(false)}
                  style={[
                    styles.declutter,
                    {
                      backgroundColor: theme.colors.card,
                      borderColor: theme.colors.border,
                      borderRadius: theme.radius.md,
                    },
                  ]}
                >
                  <Text style={[theme.text.label, { color: theme.colors.text }]}>
                    🧹 Declutter idea
                  </Text>
                  <Text style={[theme.text.caption, { color: theme.colors.textMuted }]}>
                    {declutter.length} item{declutter.length > 1 ? 's' : ''} you rarely wear —
                    “{declutter[0].reason}”. Tap to dismiss.
                  </Text>
                </Pressable>
              )}

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {CATEGORY_FILTERS.map((f) => (
                  <Chip
                    key={f.label}
                    label={f.label}
                    selected={category === f.value}
                    onPress={() => setCategory(f.value)}
                  />
                ))}
              </ScrollView>
            </View>
          }
          ListEmptyComponent={
            isLoading ? (
              <ActivityIndicator color={theme.colors.accent} style={{ marginTop: 60 }} />
            ) : (
              <EmptyState
                emoji="🧺"
                title="Your closet is empty"
                message="Capture your clothes with the camera and LAM will tag and organize them automatically."
                actionTitle="Capture your first item"
                onAction={() => router.push('/capture')}
              />
            )
          }
          renderItem={({ item }) => (
            <ItemCard item={item} onPress={() => router.push(`/item/${item.id}`)} />
          )}
        />
      </View>

      {addOpen && (
        <Pressable style={styles.sheetBackdrop} onPress={() => setAddOpen(false)}>
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                borderRadius: theme.radius.lg,
              },
            ]}
          >
            <SheetOption
              emoji="🏷️"
              label="Scan barcode"
              hint="Read the clothing tag — details fill in automatically"
              onPress={() => {
                setAddOpen(false);
                router.push('/scan');
              }}
            />
            <SheetOption
              emoji="📸"
              label="Take a photo"
              hint="Snap the garment with the camera"
              onPress={() => {
                setAddOpen(false);
                router.push('/capture');
              }}
            />
            <SheetOption
              emoji="🖼️"
              label="From gallery"
              hint="Pick an existing picture"
              onPress={pickFromGallery}
            />
          </View>
        </Pressable>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add clothing item"
        onPress={() => setAddOpen((v) => !v)}
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: pressed ? theme.colors.cardPressed : theme.colors.accent,
            bottom: insets.bottom + 20,
          },
        ]}
      >
        <Text style={[styles.fabIcon, { color: theme.colors.onAccent }]}>
          {upload.isPending ? '…' : '+'}
        </Text>
      </Pressable>
    </View>
  );

  function SheetOption({
    emoji,
    label,
    hint,
    onPress,
  }: {
    emoji: string;
    label: string;
    hint: string;
    onPress: () => void;
  }) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.sheetOption,
          pressed && { backgroundColor: theme.colors.cardPressed },
        ]}
      >
        <Text style={styles.sheetEmoji}>{emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[theme.text.label, { color: theme.colors.text }]}>{label}</Text>
          <Text style={[theme.text.caption, { color: theme.colors.textMuted }]}>{hint}</Text>
        </View>
      </Pressable>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
  column: { flex: 1, width: '100%' },
  declutter: { borderWidth: 1, padding: 12, gap: 4 },
  fab: {
    position: 'absolute',
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  fabIcon: { fontSize: 30, fontWeight: '600', lineHeight: 34 },
  sheetBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: 16,
  },
  sheet: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    borderWidth: 1,
    padding: 8,
    marginBottom: 88,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
  },
  sheetEmoji: { fontSize: 24 },
});
