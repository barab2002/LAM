import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { GestureHoldDetector, isVGesture } from './gesture';
import type { CaptureCameraHandle, CaptureCameraProps } from './types';

const MEDIAPIPE_WASM =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const HAND_LANDMARKER_MODEL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

/**
 * Web camera: getUserMedia preview + MediaPipe HandLandmarker running on
 * each animation frame. A "V" held for ~500ms fires onGestureTrigger.
 * If the model can't load (offline/CSP), the preview and manual shutter
 * still work — gesture mode just reports unavailable.
 */
export const CaptureCamera = forwardRef<CaptureCameraHandle, CaptureCameraProps>(
  function CaptureCameraWeb({ onGestureTrigger, onGestureAvailability, style }, ref) {
    const theme = useTheme();
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const rafRef = useRef<number>(0);
    const [error, setError] = useState<string | null>(null);
    const [gestureOn, setGestureOn] = useState(false);

    const triggerRef = useRef(onGestureTrigger);
    triggerRef.current = onGestureTrigger;

    const setVideoEl = useCallback((el: HTMLVideoElement | null) => {
      videoRef.current = el;
      if (el && streamRef.current) {
        el.srcObject = streamRef.current;
        el.play().catch(() => undefined);
      }
    }, []);

    useEffect(() => {
      let cancelled = false;
      let landmarker: { detectForVideo: Function; close: () => void } | null = null;

      async function start() {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1440 } },
            audio: false,
          });
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play().catch(() => undefined);
          }
        } catch (err) {
          if (!cancelled) setError('Camera access denied — allow it in your browser settings.');
          return;
        }

        // Gesture pipeline — best effort
        try {
          const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
          const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);
          const handLandmarker = await HandLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: HAND_LANDMARKER_MODEL, delegate: 'GPU' },
            runningMode: 'VIDEO',
            numHands: 1,
          });
          if (cancelled) {
            handLandmarker.close();
            return;
          }
          landmarker = handLandmarker;
          setGestureOn(true);
          onGestureAvailability?.(true);

          const hold = new GestureHoldDetector(500, () => triggerRef.current?.());
          let lastVideoTime = -1;

          const loop = () => {
            const video = videoRef.current;
            if (video && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
              lastVideoTime = video.currentTime;
              const now = performance.now();
              const result = handLandmarker.detectForVideo(video, now);
              const landmarks = result.landmarks?.[0];
              hold.update(Boolean(landmarks && isVGesture(landmarks)), now);
            }
            rafRef.current = requestAnimationFrame(loop);
          };
          rafRef.current = requestAnimationFrame(loop);
        } catch (err) {
          console.warn('[capture] gesture model unavailable:', err);
          onGestureAvailability?.(false);
        }
      }

      start();
      return () => {
        cancelled = true;
        cancelAnimationFrame(rafRef.current);
        landmarker?.close();
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useImperativeHandle(ref, () => ({
      async takePhoto() {
        const video = videoRef.current;
        if (!video || video.readyState < 2) return null;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d')!;
        // Un-mirror the selfie preview
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0);
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/jpeg', 0.9),
        );
        return blob ? { blob, mimeType: 'image/jpeg' } : null;
      },
    }));

    if (error) {
      return (
        <View style={[styles.fallback, { backgroundColor: theme.colors.card }, style]}>
          <Text style={[theme.text.body, { color: theme.colors.text, textAlign: 'center' }]}>
            {error}
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.container, style]}>
        {/* react-native-web renders this div; the raw video element gives us
            direct frame access for MediaPipe */}
        <video
          ref={setVideoEl}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: 'scaleX(-1)',
          }}
        />
        {gestureOn && (
          <View style={[styles.badge, { backgroundColor: theme.colors.overlay }]}>
            <Text style={[theme.text.caption, { color: '#fff' }]}>
              ✌️ Hold up a V to start the timer
            </Text>
          </View>
        )}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  badge: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
});
