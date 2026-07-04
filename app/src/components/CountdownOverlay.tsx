import { BlurView } from 'expo-blur';
import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { fonts, useTheme } from '../theme';

interface CountdownOverlayProps {
  /** Seconds remaining; render nothing when null */
  count: number | null;
}

/** Big animated 3-2-1 shown over the camera preview, on a soft glass backdrop. */
export function CountdownOverlay({ count }: CountdownOverlayProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (count !== null) {
      scale.value = withSequence(withTiming(1.35, { duration: 120 }), withTiming(1, { duration: 300 }));
    }
  }, [count, scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (count === null) return null;

  return (
    <BlurView intensity={30} tint="dark" style={styles.overlay} pointerEvents="none">
      <Animated.View style={animatedStyle}>
        <Text style={[styles.number, { fontFamily: fonts.extrabold }]}>{count}</Text>
      </Animated.View>
      <Text style={[theme.text.heading, styles.hint, { fontFamily: fonts.semibold }]}>
        Strike your pose
      </Text>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  number: { fontSize: 120, color: '#FFFFFF' },
  hint: { color: '#FFFFFFDD' },
});
