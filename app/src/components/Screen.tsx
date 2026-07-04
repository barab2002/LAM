import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { CONTENT_MAX_WIDTH, motion, useTheme } from '../theme';

interface ScreenProps {
  children: React.ReactNode;
  /** Scrollable content (default) or a fixed flex container */
  scroll?: boolean;
  style?: ViewStyle;
  /** Remove horizontal padding (e.g. full-bleed camera) */
  bleed?: boolean;
}

/**
 * Mobile-first screen shell: safe-area aware, and on wide (web) viewports
 * the content column stays phone-width and centered. Fades and rises in on
 * mount so screens arrive softly instead of popping in.
 */
export function Screen({ children, scroll = true, style, bleed }: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(8);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: motion.duration.base, easing: motion.easing });
    translateY.value = withTiming(0, { duration: motion.duration.base, easing: motion.easing });
  }, [opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const inner = (
    <Animated.View
      style={[
        styles.column,
        { maxWidth: bleed ? undefined : CONTENT_MAX_WIDTH },
        !bleed && { paddingHorizontal: theme.spacing(6) },
        animatedStyle,
        style,
      ]}
    >
      {children}
    </Animated.View>
  );

  if (!scroll) {
    return (
      <View
        style={[
          styles.root,
          { backgroundColor: theme.colors.background, paddingTop: bleed ? 0 : insets.top },
        ]}
      >
        {inner}
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + theme.spacing(3) }]}
    >
      {inner}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
  scrollContent: { alignItems: 'center', paddingBottom: 48 },
  column: { width: '100%', flex: 1 },
});
