import { useColorScheme } from 'react-native';

/**
 * LAM design tokens — mobile-first, light/dark aware.
 * Warm minimal palette: ink text on warm paper, terracotta accent.
 */

const palette = {
  terracotta: '#C4664B',
  terracottaDark: '#E08D72',
  ink: '#1C1917',
  paper: '#FAF7F2',
  paperCard: '#FFFFFF',
  inkDark: '#F5F0EA',
  night: '#161311',
  nightCard: '#242019',
  positive: '#3E7C4F',
  positiveDark: '#7FBF8F',
  danger: '#B3402E',
  dangerDark: '#E07B63',
};

export interface Theme {
  dark: boolean;
  colors: {
    background: string;
    card: string;
    cardPressed: string;
    text: string;
    textMuted: string;
    accent: string;
    onAccent: string;
    border: string;
    positive: string;
    danger: string;
    overlay: string;
  };
  spacing: (n: number) => number;
  radius: { sm: number; md: number; lg: number; full: number };
  text: {
    title: { fontSize: number; fontWeight: '700'; letterSpacing: number };
    heading: { fontSize: number; fontWeight: '600' };
    body: { fontSize: number; fontWeight: '400' };
    caption: { fontSize: number; fontWeight: '400' };
    label: { fontSize: number; fontWeight: '600' };
  };
}

const base = {
  spacing: (n: number) => n * 4,
  radius: { sm: 8, md: 14, lg: 22, full: 999 },
  text: {
    title: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
    heading: { fontSize: 18, fontWeight: '600' as const },
    body: { fontSize: 15, fontWeight: '400' as const },
    caption: { fontSize: 12.5, fontWeight: '400' as const },
    label: { fontSize: 13, fontWeight: '600' as const },
  },
};

export const lightTheme: Theme = {
  dark: false,
  colors: {
    background: palette.paper,
    card: palette.paperCard,
    cardPressed: '#F1EBE2',
    text: palette.ink,
    textMuted: '#78716C',
    accent: palette.terracotta,
    onAccent: '#FFFFFF',
    border: '#E7E0D5',
    positive: palette.positive,
    danger: palette.danger,
    overlay: 'rgba(28, 25, 23, 0.55)',
  },
  ...base,
};

export const darkTheme: Theme = {
  dark: true,
  colors: {
    background: palette.night,
    card: palette.nightCard,
    cardPressed: '#2E2820',
    text: palette.inkDark,
    textMuted: '#A8A29E',
    accent: palette.terracottaDark,
    onAccent: '#1C1917',
    border: '#3A332A',
    positive: palette.positiveDark,
    danger: palette.dangerDark,
    overlay: 'rgba(0, 0, 0, 0.6)',
  },
  ...base,
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? darkTheme : lightTheme;
}

/** Max content width so the mobile-first layout stays phone-shaped on web. */
export const CONTENT_MAX_WIDTH = 560;
