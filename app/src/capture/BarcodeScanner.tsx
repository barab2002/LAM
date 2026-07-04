import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { useTheme } from '../theme';

export interface BarcodeScannerProps {
  /** Called once per detected code (debounced by the parent). */
  onCode: (code: string) => void;
  style?: object;
}

/** Native barcode scanner — expo-camera's built-in detector. */
export function BarcodeScanner({ onCode, style }: BarcodeScannerProps) {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const lastCode = useRef<string>('');

  if (!permission?.granted) {
    return (
      <View style={[styles.permission, { backgroundColor: theme.colors.card }, style]}>
        <Text style={[theme.text.body, { color: theme.colors.text, textAlign: 'center' }]}>
          Camera access is needed to scan clothing barcodes.
        </Text>
        <Button title="Allow camera" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <CameraView
      style={[styles.camera, style]}
      facing="back"
      barcodeScannerSettings={{
        barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'],
      }}
      onBarcodeScanned={({ data }) => {
        const digits = data.replace(/\D/g, '');
        if (digits.length >= 8 && digits !== lastCode.current) {
          lastCode.current = digits;
          onCode(digits);
        }
      }}
    />
  );
}

const styles = StyleSheet.create({
  camera: { flex: 1 },
  permission: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
});
