import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { WeatherSnapshot } from '../types/api';
import { useTheme } from '../theme';

const CONDITION_EMOJI: Record<string, string> = {
  clear: '☀️',
  'partly-cloudy': '⛅',
  cloudy: '☁️',
  fog: '🌫️',
  drizzle: '🌦️',
  rain: '🌧️',
  snow: '❄️',
  thunderstorm: '⛈️',
};

export function WeatherHeader({ weather }: { weather: WeatherSnapshot }) {
  const theme = useTheme();
  const emoji = CONDITION_EMOJI[weather.condition] ?? '🌤️';
  const range =
    weather.tempMinC != null && weather.tempMaxC != null
      ? ` · ${Math.round(weather.tempMinC)}–${Math.round(weather.tempMaxC)}°`
      : '';

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radius.md },
      ]}
    >
      <Text style={styles.emoji}>{emoji}</Text>
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
    gap: 12,
    padding: 14,
    borderWidth: 1,
  },
  emoji: { fontSize: 30 },
});
