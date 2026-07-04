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
import { useDeclutter, useItems } from '../../api/hooks';
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

  const { data: items, isLoading } = useItems({ category });
  const { data: declutter } = useDeclutter();

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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
  column: { flex: 1, width: '100%' },
  declutter: { borderWidth: 1, padding: 12, gap: 4 },
});
