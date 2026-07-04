import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useAddFromBarcode, useBarcodeLookup } from '../api/hooks';
import { BarcodeScanner } from '../capture/BarcodeScanner';
import { Button } from '../components/Button';
import { CONTENT_MAX_WIDTH, useTheme } from '../theme';
import type { BarcodeLookupDto } from '../types/api';

export default function ScanScreen() {
  const theme = useTheme();
  const router = useRouter();
  const lookup = useBarcodeLookup();
  const addFromBarcode = useAddFromBarcode();

  const [manualCode, setManualCode] = useState('');
  const [product, setProduct] = useState<BarcodeLookupDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCode = useCallback(
    async (code: string) => {
      if (lookup.isPending || product) return;
      setError(null);
      try {
        setProduct(await lookup.mutateAsync(code));
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [lookup, product],
  );

  const addToCloset = async () => {
    if (!product) return;
    setError(null);
    try {
      const result = await addFromBarcode.mutateAsync(product.barcode);
      router.replace(`/item/${result.item.id}`);
    } catch {
      // No usable product image — fall back to the mirror camera
      setError('No product photo available — snap a picture of it instead.');
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <View style={styles.scannerWrap}>
        <BarcodeScanner onCode={handleCode} style={styles.scanner} />
      </View>

      <View style={[styles.panel, { maxWidth: CONTENT_MAX_WIDTH }]}>
        {!product && (
          <>
            <Text style={[theme.text.caption, { color: theme.colors.textMuted }]}>
              Point at the barcode on the clothing tag — or type it:
            </Text>
            <View style={styles.manualRow}>
              <TextInput
                style={[
                  styles.input,
                  theme.text.body,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                    borderRadius: theme.radius.md,
                  },
                ]}
                placeholder="e.g. 4002515289693"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="number-pad"
                value={manualCode}
                onChangeText={setManualCode}
                onSubmitEditing={() => manualCode.length >= 8 && handleCode(manualCode)}
              />
              <Button
                title="Look up"
                compact
                onPress={() => handleCode(manualCode)}
                loading={lookup.isPending}
                disabled={manualCode.replace(/\D/g, '').length < 8}
              />
            </View>
          </>
        )}

        {product && (
          <View
            style={[
              styles.product,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                borderRadius: theme.radius.md,
              },
            ]}
          >
            {product.imageUrl && (
              <Image
                source={product.imageUrl}
                style={[styles.productImage, { backgroundColor: theme.colors.cardPressed }]}
                contentFit="contain"
              />
            )}
            <View style={styles.productMeta}>
              <Text style={[theme.text.label, { color: theme.colors.text }]} numberOfLines={2}>
                {product.found ? (product.title ?? 'Unknown product') : 'Product not found'}
              </Text>
              <Text style={[theme.text.caption, { color: theme.colors.textMuted }]}>
                {product.brand ?? product.barcode}
              </Text>
            </View>

            {product.existingItemId ? (
              <Button
                title="Already in your closet — open it"
                variant="secondary"
                onPress={() => router.replace(`/item/${product.existingItemId}`)}
              />
            ) : product.found && product.imageUrl ? (
              <Button
                title="Add to closet"
                onPress={addToCloset}
                loading={addFromBarcode.isPending}
              />
            ) : (
              <Button
                title="Add it with a photo instead"
                onPress={() => router.replace('/capture')}
              />
            )}
            <Button title="Scan another" variant="ghost" onPress={() => setProduct(null)} />
          </View>
        )}

        {error && (
          <Text style={[theme.text.caption, { color: theme.colors.danger, textAlign: 'center' }]}>
            {error}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
  scannerWrap: { flex: 1, alignSelf: 'stretch' },
  scanner: { flex: 1 },
  panel: { width: '100%', padding: 16, gap: 10 },
  manualRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  input: { flex: 1, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  product: { borderWidth: 1, padding: 14, gap: 10 },
  productImage: { width: '100%', height: 160, borderRadius: 10 },
  productMeta: { gap: 2 },
});
