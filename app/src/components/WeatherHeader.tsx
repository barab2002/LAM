import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { WeatherSnapshot } from '../types/api';
import { Icon, IconName } from './Icon';
import { useTheme } from '../theme';

const CONDITION_ICON: Record<string, IconName> = {
  clear: 'sunny-outline',
  'partly-cloudy': 'partly-sunny-outline',
  cloudy: 'cloudy-outline',
  fog: 'cloudy-outline',
  drizzle: 'rainy-outline',
  rain: 'rainy-outline',
  snow: 'snow-outline',
  thunderstorm: 'thunderstorm-outline',
};

export function WeatherHeader({ weather }: { weather: WeatherSnapshot }) {
  const theme = useTheme();
  const icon = CONDITION_ICON[weather.condition] ?? 'partly-sunny-outline';
  const range =
    weather.tempMinC != null && weather.tempMaxC != null
      ? ` · ${Math.round(weather.tempMinC)}–${Math.round(weather.tempMaxC)}°`
      : '';

  return (
    <View
      style={[
        styles.container,
        theme.shadow('sm'),
        { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radius.lg },
      ]}
    >
      <View style={[styles.iconChip, { backgroundColor: theme.colors.accentMuted }]}>
        <Icon name={icon} size={theme.iconSize.lg} color={theme.colors.accent} />
      </View>
      <View>
        <Text style={[theme.text.heading, { color: theme.colors.text }]}>
          {Math.round(weather.tempC)}°C{range}
        </Text>
        <Text style={[theme.text.caption, { color: theme.colors.textMuted }]}>
          Suggestions tuned to today's weather
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderWidth: 1,
  },
  iconChip: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
