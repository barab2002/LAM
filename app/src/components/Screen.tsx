import React from 'react';
import { ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CONTENT_MAX_WIDTH, useTheme } from '../theme';

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
 * the content column stays phone-width and centered.
 */
export function Screen({ children, scroll = true, style, bleed }: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const inner = (
    <View
      style={[
        styles.column,
        { maxWidth: bleed ? undefined : CONTENT_MAX_WIDTH },
        !bleed && { paddingHorizontal: theme.spacing(5) },
        style,
      ]}
    >
      {children}
    </View>
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
