import { Platform, useColorScheme } from 'react-native';
import { Easing } from 'react-native-reanimated';

/**
 * LAM design tokens — "Champagne & Ink": warm off-white/near-black base,
 * a muted champagne-gold accent (verified against onAccent for AA contrast
 * at button-label size — see onAccent below), Plus Jakarta Sans throughout.
 */

const palette = {
  gold: '#B08D4F',
  goldDark: '#D4B876',
  ink: '#1C1917',
  inkSoft: '#1A1611',
  paper: '#FBF9F5',
  paperCard: '#FFFFFF',
  inkDark: '#F5F0E8',
  night: '#14110E',
  nightCard: '#211C16',
  positive: '#2F6B4A',
  positiveDark: '#6FBF93',
  danger: '#9B4A3A',
  dangerDark: '#E2836B',
};

export interface Theme {
  dark: boolean;
  colors: {
    background: string;
    card: string;
    /** Sunken surface for inputs and skeleton placeholders */
    surfaceSunken: string;
    cardPressed: string;
    text: string;
    textMuted: string;
    /** Tertiary text — placeholders, disabled labels */
    textFaint: string;
    accent: string;
    /** Low-opacity accent tint for badges and selected-but-legible states */
    accentMuted: string;
    onAccent: string;
    border: string;
    /** Stronger border for focus rings */
    borderStrong: string;
    positive: string;
    positiveSurface: string;
    danger: string;
    dangerSurface: string;
    overlay: string;
    /** Warm-tinted shadow color (not flat black) */
    shadow: string;
  };
  spacing: (n: number) => number;
  radius: { sm: number; md: number; lg: number; xl: number; full: number };
  iconSize: { sm: number; md: number; lg: number; xl: number };
  text: {
    title: { fontSize: number; fontFamily: string; letterSpacing: number };
    heading: { fontSize: number; fontFamily: string; letterSpacing: number };
    body: { fontSize: number; fontFamily: string };
    caption: { fontSize: number; fontFamily: string };
    label: { fontSize: number; fontFamily: string; letterSpacing: number };
  };
  /** Shared elevation recipe — spread onto a style array alongside colors.shadow */
  shadow: (level: 'sm' | 'md' | 'lg') => object;
}

/** Loaded by name in _layout.tsx via @expo-google-fonts/plus-jakarta-sans */
export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
};

/** Shared motion tokens — durations in ms + a single easing curve for consistency. */
export const motion = {
  duration: { fast: 150, base: 220, slow: 340 },
  easing: Easing.out(Easing.cubic),
};

function shadowRecipe(color: string) {
  return (level: 'sm' | 'md' | 'lg') => {
    const spec = { sm: { h: 2, r: 6, o: 0.5 }, md: { h: 4, r: 12, o: 0.7 }, lg: { h: 8, r: 24, o: 1 } }[
      level
    ];
    // react-native-web deprecates shadow*/elevation in favor of the CSS
    // boxShadow shorthand — branch so web gets no console warning.
    if (Platform.OS === 'web') {
      return { boxShadow: `0px ${spec.h}px ${spec.r}px ${color}` };
    }
    return {
      shadowColor: color,
      shadowOffset: { width: 0, height: spec.h },
      shadowRadius: spec.r,
      shadowOpacity: spec.o,
      elevation: spec.h * 1.5,
    };
  };
}

const base = {
  spacing: (n: number) => n * 4,
  radius: { sm: 10, md: 18, lg: 26, xl: 32, full: 999 },
  iconSize: { sm: 16, md: 20, lg: 24, xl: 32 },
  text: {
    title: { fontSize: 30, fontFamily: fonts.extrabold, letterSpacing: -0.6 },
    heading: { fontSize: 18, fontFamily: fonts.semibold, letterSpacing: -0.2 },
    body: { fontSize: 15, fontFamily: fonts.regular },
    caption: { fontSize: 12.5, fontFamily: fonts.medium },
    label: { fontSize: 13, fontFamily: fonts.semibold, letterSpacing: 0.1 },
  },
};

export const lightTheme: Theme = {
  dark: false,
  colors: {
    background: palette.paper,
    card: palette.paperCard,
    surfaceSunken: '#F3EEE5',
    cardPressed: '#F1EBDE',
    text: palette.ink,
    textMuted: '#7A7268',
    textFaint: '#A69C8D',
    accent: palette.gold,
    accentMuted: '#F3EAD5',
    // Ink (not white) on gold: ~5.6:1 contrast: white-on-gold is only ~3.1:1
    // and fails AA at button-label text sizes.
    onAccent: palette.ink,
    border: '#E8E1D3',
    borderStrong: '#D8CCB0',
    positive: palette.positive,
    positiveSurface: '#E8F0E9',
    danger: palette.danger,
    dangerSurface: '#F5E7E3',
    overlay: 'rgba(28, 25, 23, 0.55)',
    shadow: 'rgba(28, 25, 23, 0.16)',
  },
  ...base,
  shadow: shadowRecipe('rgba(28, 25, 23, 0.16)'),
};

export const darkTheme: Theme = {
  dark: true,
  colors: {
    background: palette.night,
    card: palette.nightCard,
    surfaceSunken: '#1A160F',
    cardPressed: '#2C2519',
    text: palette.inkDark,
    textMuted: '#A79E8E',
    textFaint: '#756B5C',
    accent: palette.goldDark,
    accentMuted: 'rgba(212, 184, 118, 0.16)',
    onAccent: palette.inkSoft,
    border: '#362D20',
    borderStrong: '#4A3D28',
    positive: palette.positiveDark,
    positiveSurface: 'rgba(111, 191, 147, 0.14)',
    danger: palette.dangerDark,
    dangerSurface: 'rgba(226, 131, 107, 0.14)',
    overlay: 'rgba(0, 0, 0, 0.6)',
    shadow: 'rgba(0, 0, 0, 0.45)',
  },
  ...base,
  shadow: shadowRecipe('rgba(0, 0, 0, 0.45)'),
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? darkTheme : lightTheme;
}

/** Max content width so the mobile-first layout stays phone-shaped on web. */
export const CONTENT_MAX_WIDTH = 560;
