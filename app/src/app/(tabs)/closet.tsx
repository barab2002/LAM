import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useDeclutter, useItems, useUploadItem } from '../../api/hooks';
import { EmptyState } from '../../components/EmptyState';
import { Chip } from '../../components/Chip';
import { Icon, IconName } from '../../components/Icon';
import { ItemCard } from '../../components/ItemCard';
import { ItemCardSkeleton } from '../../components/Skeleton';
import { tapHaptic } from '../../lib/haptics';
import { CONTENT_MAX_WIDTH, motion, useTheme } from '../../theme';

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

  const fabScale = useSharedValue(1);
  const sheetProgress = useSharedValue(0);

  useEffect(() => {
    sheetProgress.value = withTiming(addOpen ? 1 : 0, {
      duration: motion.duration.base,
      easing: motion.easing,
    });
  }, [addOpen, sheetProgress]);

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: sheetProgress.value,
    transform: [{ translateY: (1 - sheetProgress.value) * 24 }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: sheetProgress.value }));
  const fabStyle = useAnimatedStyle(() => ({ transform: [{ scale: fabScale.value }] }));

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
            <View style={{ paddingTop: insets.top + 12, gap: 14 }}>
              <View>
                <Text style={[theme.text.title, { color: theme.colors.text }]}>Closet</Text>
                {items && (
                  <Text style={[theme.text.caption, { color: theme.colors.textMuted }]}>
                    {items.length} piece{items.length === 1 ? '' : 's'}
                  </Text>
                )}
              </View>

              {declutter && declutter.length > 0 && showDeclutter && (
                <Pressable
                  onPress={() => setShowDeclutter(false)}
                  style={[
                    styles.declutter,
                    theme.shadow('sm'),
                    {
                      backgroundColor: theme.colors.card,
                      borderColor: theme.colors.border,
                      borderRadius: theme.radius.lg,
                    },
                  ]}
                >
                  <View style={[styles.declutterIcon, { backgroundColor: theme.colors.accentMuted }]}>
                    <Icon name="trash-outline" size={theme.iconSize.lg} color={theme.colors.accent} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[theme.text.label, { color: theme.colors.text }]}>
                      Declutter idea
                    </Text>
                    <Text style={[theme.text.caption, { color: theme.colors.textMuted }]}>
                      {declutter.length} item{declutter.length > 1 ? 's' : ''} you rarely wear —
                      “{declutter[0].reason}”
                    </Text>
                  </View>
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
              <View style={styles.skeletonGrid}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <ItemCardSkeleton key={i} />
                ))}
              </View>
            ) : (
              <EmptyState
                icon="shirt-outline"
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
        <Animated.View style={[styles.sheetBackdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAddOpen(false)}>
            <BlurView
              intensity={20}
              tint={theme.dark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          </Pressable>
        </Animated.View>
      )}

      {addOpen && (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.sheetWrap, sheetStyle]}
        >
          <View
            style={[
              styles.sheet,
              theme.shadow('lg'),
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View style={[styles.grabber, { backgroundColor: theme.colors.border }]} />
            <SheetOption
              icon="pricetag-outline"
              label="Scan barcode"
              hint="Read the clothing tag — details fill in automatically"
              onPress={() => {
                setAddOpen(false);
                router.push('/scan');
              }}
            />
            <SheetOption
              icon="camera-outline"
              label="Take a photo"
              hint="Snap the garment with the camera"
              onPress={() => {
                setAddOpen(false);
                router.push('/capture');
              }}
            />
            <SheetOption
              icon="image-outline"
              label="From gallery"
              hint="Pick an existing picture"
              onPress={pickFromGallery}
            />
          </View>
        </Animated.View>
      )}

      <Animated.View style={[styles.fabWrap, { bottom: insets.bottom + 20 }, fabStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add clothing item"
          onPress={() => {
            tapHaptic('medium');
            setAddOpen((v) => !v);
          }}
          onPressIn={() => {
            fabScale.value = withTiming(0.92, { duration: motion.duration.fast });
          }}
          onPressOut={() => {
            fabScale.value = withSpring(1, { damping: 10 });
          }}
          style={[styles.fab, theme.shadow('md'), { backgroundColor: theme.colors.accent }]}
        >
          {upload.isPending ? (
            <Text style={[styles.fabIcon, { color: theme.colors.onAccent }]}>…</Text>
          ) : (
            <Icon
              name={addOpen ? 'close' : 'add'}
              size={theme.iconSize.xl}
              color={theme.colors.onAccent}
            />
          )}
        </Pressable>
      </Animated.View>
    </View>
  );

  function SheetOption({
    icon,
    label,
    hint,
    onPress,
  }: {
    icon: IconName;
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
          {
            backgroundColor: pressed ? theme.colors.cardPressed : theme.colors.surfaceSunken,
            borderRadius: theme.radius.md,
          },
        ]}
      >
        <View style={[styles.sheetIconChip, { backgroundColor: theme.colors.accentMuted }]}>
          <Icon name={icon} size={theme.iconSize.md} color={theme.colors.accent} />
        </View>
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
  declutter: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, padding: 14 },
  declutterIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 6 },
  fabWrap: { position: 'absolute', right: 20 },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabIcon: { fontSize: 30, fontWeight: '600', lineHeight: 34 },
  sheetBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  sheetWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    padding: 16,
  },
  sheet: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    borderWidth: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    padding: 10,
    paddingTop: 12,
    gap: 4,
    marginBottom: 88,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
  },
  sheetIconChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
