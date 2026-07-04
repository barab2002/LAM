import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { Button } from '../components/Button';
import type { CaptureCameraHandle, CaptureCameraProps } from './types';

/**
 * Native camera (expo-camera front lens).
 *
 * Hands-free gesture detection needs per-frame landmarks, which requires a
 * dev-client build with react-native-vision-camera + a hand-landmark model
 * (see README "Native gesture detection"). Until that's wired, natives get
 * the 3-second self-timer + shutter; the shared classifier in gesture.ts is
 * ready to consume landmarks from a frame processor.
 */
export const CaptureCamera = forwardRef<CaptureCameraHandle, CaptureCameraProps>(
  function CaptureCameraNative({ onGestureAvailability, style }, ref) {
    const theme = useTheme();
    const cameraRef = useRef<CameraView>(null);
    const [permission, requestPermission] = useCameraPermissions();

    useEffect(() => {
      onGestureAvailability?.(false);
    }, [onGestureAvailability]);

    useImperativeHandle(ref, () => ({
      async takePhoto() {
        const photo = await cameraRef.current?.takePictureAsync({ quality: 0.85 });
        if (!photo?.uri) return null;
        return { uri: photo.uri, mimeType: 'image/jpeg' };
      },
    }));

    if (!permission?.granted) {
      return (
        <View style={[styles.permission, { backgroundColor: theme.colors.card }, style]}>
          <Text style={[theme.text.body, { color: theme.colors.text, textAlign: 'center' }]}>
            LAM needs camera access to capture your outfits.
          </Text>
          <Button title="Allow camera" onPress={requestPermission} />
        </View>
      );
    }

    return <CameraView ref={cameraRef} style={[styles.camera, style]} facing="front" />;
  },
);

const styles = StyleSheet.create({
  camera: { flex: 1 },
  permission: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
});
