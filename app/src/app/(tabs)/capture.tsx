import { useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRateOutfit, useUploadItem } from '../../api/hooks';
import { CaptureCamera } from '../../capture/CaptureCamera';
import type { CaptureCameraHandle, CapturedPhoto } from '../../capture/types';
import { CountdownOverlay } from '../../components/CountdownOverlay';
import { useTheme } from '../../theme';

type Phase = 'idle' | 'countdown' | 'uploading' | 'done' | 'error';

export default function CaptureScreen() {
  const theme = useTheme();
  const router = useRouter();
  const cameraRef = useRef<CaptureCameraHandle>(null);
  const upload = useUploadItem();

  const [phase, setPhase] = useState<Phase>('idle');
  const [count, setCount] = useState<number | null>(null);
  const [gestureAvailable, setGestureAvailable] = useState(false);
  const [lastTagged, setLastTagged] = useState<string | null>(null);
  const [lastItemId, setLastItemId] = useState<string | null>(null);
  const countdownRunning = useRef(false);
  const rateOutfit = useRateOutfit();

  const rateThisFit = async () => {
    if (!lastItemId || rateOutfit.isPending) return;
    const rating = await rateOutfit.mutateAsync({ itemId: lastItemId });
    router.push(`/rating/${rating.id}`);
  };

  const uploadPhoto = useCallback(
    async (photo: CapturedPhoto) => {
      setPhase('uploading');
      try {
        const form = new FormData();
        if (photo.blob) {
          form.append('image', photo.blob, 'capture.jpg');
        } else if (photo.uri) {
          // React Native FormData file descriptor
          form.append('image', {
            uri: photo.uri,
            name: 'capture.jpg',
            type: photo.mimeType,
          } as unknown as Blob);
        }
        const result = await upload.mutateAsync(form);
        setLastItemId(result.item.id);
        setLastTagged(
          result.aiTagged
            ? `Tagged as ${result.item.subcategory ?? result.item.category.toLowerCase()}${
                result.item.primaryColor ? ` · ${result.item.primaryColor}` : ''
              }`
            : 'Saved — add tags in your closet',
        );
        setPhase('done');
      } catch (err) {
        console.warn('[capture] upload failed:', err);
        setPhase('error');
      }
    },
    [upload],
  );

  const startCountdown = useCallback(() => {
    if (countdownRunning.current) return;
    countdownRunning.current = true;
    setPhase('countdown');

    let remaining = 3;
    setCount(remaining);
    const timer = setInterval(async () => {
      remaining -= 1;
      if (remaining > 0) {
        setCount(remaining);
        return;
      }
      clearInterval(timer);
      setCount(null);
      countdownRunning.current = false;
      const photo = await cameraRef.current?.takePhoto();
      if (photo) await uploadPhoto(photo);
      else setPhase('idle');
    }, 1000);
  }, [uploadPhoto]);

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <CaptureCamera
        ref={cameraRef}
        onGestureTrigger={startCountdown}
        onGestureAvailability={setGestureAvailable}
        style={styles.camera}
      />

      <CountdownOverlay count={count} />

      {(phase === 'done' || phase === 'error' || phase === 'uploading') && (
        <View style={[styles.banner, { backgroundColor: theme.colors.overlay }]}>
          <Text style={[theme.text.body, { color: '#fff', textAlign: 'center' }]}>
            {phase === 'uploading'
              ? '✂️ Removing background & tagging…'
              : phase === 'error'
                ? 'Upload failed — is the server running?'
                : `✅ Added to your closet. ${lastTagged}`}
          </Text>
          {phase === 'done' && (
            <View style={styles.bannerActions}>
              <Pressable onPress={rateThisFit} disabled={rateOutfit.isPending}>
                <Text style={[theme.text.label, { color: '#FFD9CB' }]}>
                  {rateOutfit.isPending ? 'Jury deliberating…' : '🗣️ Rate this fit'}
                </Text>
              </Pressable>
              <Pressable onPress={() => router.push('/closet')}>
                <Text style={[theme.text.label, { color: '#FFD9CB' }]}>
                  Open closet →
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      <View style={styles.controls}>
        <Text style={[theme.text.caption, styles.hint]}>
          {gestureAvailable
            ? '✌️ Show a V sign — or tap the shutter'
            : Platform.OS === 'web'
              ? 'Tap the shutter to capture'
              : 'Tap the shutter — 3-second timer'}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Capture with 3 second timer"
          onPress={startCountdown}
          disabled={phase === 'countdown' || phase === 'uploading'}
          style={({ pressed }) => [
            styles.shutter,
            {
              borderColor: '#FFFFFF',
              backgroundColor: pressed ? theme.colors.accent : 'rgba(255,255,255,0.25)',
              opacity: phase === 'countdown' || phase === 'uploading' ? 0.4 : 1,
            },
          ]}
        >
          <View style={styles.shutterInner} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  camera: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  banner: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    padding: 14,
    borderRadius: 14,
    gap: 8,
    alignItems: 'center',
  },
  bannerActions: { flexDirection: 'row', gap: 24 },
  controls: {
    position: 'absolute',
    bottom: 36,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 14,
  },
  hint: {
    color: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
  },
});
