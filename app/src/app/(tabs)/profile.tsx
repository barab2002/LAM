import * as Location from 'expo-location';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useProfile, useUpdateProfile } from '../../api/hooks';
import { useAuth } from '../../auth/AuthContext';
import { BodyShapeIcon } from '../../components/BodyShapeIcon';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Screen } from '../../components/Screen';
import { tapHaptic } from '../../lib/haptics';
import type { BodyShape } from '../../types/api';
import { useTheme } from '../../theme';

const BODY_SHAPES: { value: BodyShape; label: string; hint: string }[] = [
  { value: 'HOURGLASS', label: 'Hourglass', hint: 'Balanced bust & hips, defined waist' },
  { value: 'PEAR', label: 'Pear', hint: 'Hips wider than shoulders' },
  { value: 'APPLE', label: 'Apple', hint: 'Fuller middle, slimmer legs' },
  { value: 'RECTANGLE', label: 'Rectangle', hint: 'Similar bust, waist & hips' },
  { value: 'INVERTED_TRIANGLE', label: 'Inv. Triangle', hint: 'Shoulders wider than hips' },
];

export default function ProfileScreen() {
  const theme = useTheme();
  const { email, devMode, logOut } = useAuth();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const [locationBusy, setLocationBusy] = useState(false);

  const setBodyShape = (bodyShape: BodyShape) => {
    tapHaptic();
    updateProfile.mutate({ bodyShape });
  };

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
      <View style={styles.identity}>
        <View style={[styles.avatar, { backgroundColor: theme.colors.accentMuted }]}>
          <Icon name="person" size={theme.iconSize.lg} color={theme.colors.accent} />
        </View>
        <View>
          <Text style={[theme.text.title, { color: theme.colors.text, fontSize: 24 }]}>
            Profile
          </Text>
          <Text style={[theme.text.caption, { color: theme.colors.textMuted }]}>
            {email}
            {devMode ? '  ·  dev mode' : ''}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.card,
          theme.shadow('sm'),
          { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radius.lg },
        ]}
      >
        <Text style={[theme.text.heading, { color: theme.colors.text }]}>Body shape</Text>
        <Text style={[theme.text.caption, { color: theme.colors.textMuted, marginBottom: 4 }]}>
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
                    backgroundColor: selected ? theme.colors.accentMuted : theme.colors.surfaceSunken,
                    borderColor: selected ? theme.colors.accent : theme.colors.border,
                    borderWidth: selected ? 1.5 : 1,
                    borderRadius: theme.radius.md,
                  },
                ]}
              >
                <BodyShapeIcon
                  shape={shape.value}
                  color={selected ? theme.colors.accent : theme.colors.textMuted}
                />
                <Text
                  style={[
                    theme.text.label,
                    { color: selected ? theme.colors.accent : theme.colors.text },
                  ]}
                >
                  {shape.label}
                </Text>
                <Text
                  style={[
                    theme.text.caption,
                    { color: theme.colors.textMuted, textAlign: 'center' },
                  ]}
                >
                  {shape.hint}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View
        style={[
          styles.card,
          theme.shadow('sm'),
          { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radius.lg },
        ]}
      >
        <Text style={[theme.text.heading, { color: theme.colors.text }]}>Weather location</Text>
        <Text style={[theme.text.caption, { color: theme.colors.textMuted, marginBottom: 4 }]}>
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
      </View>

      <Button title="Sign out" variant="danger" onPress={logOut} />
      <View style={{ height: 40 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1, padding: 18, gap: 6, marginBottom: 16 },
  shapes: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  shape: {
    flexGrow: 1,
    flexBasis: '30%',
    alignItems: 'center',
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
});
