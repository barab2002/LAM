import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import type { BarcodeScannerProps } from './BarcodeScanner';

type DetectedBarcode = { rawValue: string };
type BarcodeDetectorLike = { detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]> };
type BarcodeDetectorCtor = new (opts: { formats: string[] }) => BarcodeDetectorLike;

/**
 * Web barcode scanner: getUserMedia preview + the browser's native
 * BarcodeDetector API (Chrome/Edge/Android). Browsers without it just don't
 * render the live scanner — the scan screen always offers manual entry.
 */
export function BarcodeScanner({ onCode, style }: BarcodeScannerProps) {
  const theme = useTheme();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastCode = useRef('');
  const [status, setStatus] = useState<'starting' | 'scanning' | 'unsupported' | 'denied'>(
    'starting',
  );

  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  const setVideoEl = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && streamRef.current) {
      el.srcObject = streamRef.current;
      el.play().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const Detector = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    if (!Detector) {
      setStatus('unsupported');
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
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
        const detector = new Detector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'],
        });
        setStatus('scanning');

        timer = setInterval(async () => {
          const video = videoRef.current;
          if (!video || video.readyState < 2) return;
          try {
            const codes = await detector.detect(video);
            const digits = codes[0]?.rawValue?.replace(/\D/g, '') ?? '';
            if (digits.length >= 8 && digits !== lastCode.current) {
              lastCode.current = digits;
              onCodeRef.current(digits);
            }
          } catch {
            // detection errors are transient — keep polling
          }
        }, 350);
      } catch {
        if (!cancelled) setStatus('denied');
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  if (status === 'unsupported' || status === 'denied') {
    return (
      <View style={[styles.fallback, { backgroundColor: theme.colors.card }, style]}>
        <Text style={[theme.text.body, { color: theme.colors.textMuted, textAlign: 'center' }]}>
          {status === 'unsupported'
            ? 'Live scanning needs Chrome/Edge — type the barcode below instead.'
            : 'Camera unavailable — type the barcode below instead.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <video
        ref={setVideoEl}
        autoPlay
        playsInline
        muted
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <View style={[styles.reticle, { borderColor: theme.colors.accent }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  reticle: {
    position: 'absolute',
    top: '30%',
    left: '12%',
    right: '12%',
    height: '40%',
    borderWidth: 3,
    borderRadius: 16,
    opacity: 0.85,
  },
});
