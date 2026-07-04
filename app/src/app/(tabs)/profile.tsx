import * as Location from 'expo-location';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useProfile, useUpdateProfile } from '../../api/hooks';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import type { BodyShape } from '../../types/api';
import { useTheme } from '../../theme';

const BODY_SHAPES: { value: BodyShape; label: string; silhouette: string; hint: string }[] = [
  { value: 'HOURGLASS', label: 'Hourglass', silhouette: '⏳', hint: 'Balanced bust & hips, defined waist' },
  { value: 'PEAR', label: 'Pear', silhouette: '🍐', hint: 'Hips wider than shoulders' },
  { value: 'APPLE', label: 'Apple', silhouette: '🍎', hint: 'Fuller middle, slimmer legs' },
  { value: 'RECTANGLE', label: 'Rectangle', silhouette: '▭', hint: 'Similar bust, waist & hips' },
  { value: 'INVERTED_TRIANGLE', label: 'Inv. Triangle', silhouette: '🔻', hint: 'Shoulders wider than hips' },
];

export default function ProfileScreen() {
  const theme = useTheme();
  const { email, devMode, logOut } = useAuth();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const [locationBusy, setLocationBusy] = useState(false);

  const setBodyShape = (bodyShape: BodyShape) => updateProfile.mutate({ bodyShape });

  const shareLocation = async () => {
    setLocationBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos =
        (await Location.getLastKnownPositionAsync()) ??
        (await Location.getCurrentPositionAsync({}));
      if (pos) {
        await updateProfile.mutateAsync({
          locationLat: pos.coords.latitude,
          locationLon: pos.coords.longitude,
        });
      }
    } finally {
      setLocationBusy(false);
    }
  };

  return (
    <Screen>
      <Text style={[theme.text.title, { color: theme.colors.text, marginBottom: 4 }]}>
        Profile
      </Text>
      <Text style={[theme.text.body, { color: theme.colors.textMuted, marginBottom: 20 }]}>
        {email}
        {devMode ? '  ·  dev mode' : ''}
      </Text>

      <Text style={[theme.text.heading, { color: theme.colors.text, marginBottom: 6 }]}>
        Body shape
      </Text>
      <Text style={[theme.text.caption, { color: theme.colors.textMuted, marginBottom: 12 }]}>
        Used to pick silhouettes that flatter you. Private — never shared.
      </Text>
      <View style={styles.shapes}>
        {BODY_SHAPES.map((shape) => {
          const selected = profile?.bodyShape === shape.value;
          return (
            <Pressable
              key={shape.value}
              accessibilityRole="button"
              onPress={() => setBodyShape(shape.value)}
              style={[
                styles.shape,
                {
                  backgroundColor: selected ? theme.colors.accent : theme.colors.card,
                  borderColor: selected ? theme.colors.accent : theme.colors.border,
                  borderRadius: theme.radius.md,
                },
              ]}
            >
              <Text style={styles.silhouette}>{shape.silhouette}</Text>
              <Text
                style={[
                  theme.text.label,
                  { color: selected ? theme.colors.onAccent : theme.colors.text },
                ]}
              >
                {shape.label}
              </Text>
              <Text
                style={[
                  theme.text.caption,
                  {
                    color: selected ? theme.colors.onAccent : theme.colors.textMuted,
                    textAlign: 'center',
                  },
                ]}
              >
                {shape.hint}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ height: 24 }} />
      <Text style={[theme.text.heading, { color: theme.colors.text, marginBottom: 6 }]}>
        Weather location
      </Text>
      <Text style={[theme.text.caption, { color: theme.colors.textMuted, marginBottom: 12 }]}>
        {profile?.locationLat != null
          ? `Saved (${profile.locationLat.toFixed(2)}, ${profile.locationLon?.toFixed(2)}) — suggestions use your local forecast.`
          : 'Share your location once so daily suggestions match your weather.'}
      </Text>
      <Button
        title={profile?.locationLat != null ? 'Update location' : 'Share location'}
        variant="secondary"
        onPress={shareLocation}
        loading={locationBusy}
      />

      <View style={{ height: 32 }} />
      <Button title="Sign out" variant="danger" onPress={logOut} />
      <View style={{ height: 40 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  shapes: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  shape: {
    flexGrow: 1,
    flexBasis: '30%',
    alignItems: 'center',
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  silhouette: { fontSize: 28 },
});
