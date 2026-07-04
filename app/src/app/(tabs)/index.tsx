import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLogWear, useRateOutfit, useSendFeedback, useSuggestions } from '../../api/hooks';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { OutfitCard } from '../../components/OutfitCard';
import { OutfitCardSkeleton, Skeleton } from '../../components/Skeleton';
import { Screen } from '../../components/Screen';
import { WeatherHeader } from '../../components/WeatherHeader';
import { useTheme } from '../../theme';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Still up?';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function firstName(email: string | null | undefined): string {
  if (!email) return '';
  const name = email.split('@')[0].replace(/[._-]+/g, ' ').trim();
  if (!name) return '';
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export default function TodayScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { email } = useAuth();
  const [coords, setCoords] = useState<{ lat: number; lon: number } | undefined>();
  const [cursor, setCursor] = useState(0);
  const [wornConfirmed, setWornConfirmed] = useState(false);

  const { data, isLoading, refetch } = useSuggestions(coords);
  const feedback = useSendFeedback();
  const logWear = useLogWear();
  const rateOutfit = useRateOutfit();

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const position = await Location.getLastKnownPositionAsync();
      const current = position ?? (await Location.getCurrentPositionAsync({}));
      if (current) {
        setCoords({ lat: current.coords.latitude, lon: current.coords.longitude });
      }
    })().catch(() => undefined);
  }, []);

  const suggestions = data?.suggestions ?? [];
  const current = suggestions[cursor];

  const rate = (liked: boolean) => {
    if (!current) return;
    feedback.mutate({ itemIds: current.items.map((i) => i.id), liked });
    setCursor((c) => c + 1);
  };

  const askTheJury = async () => {
    if (!current || rateOutfit.isPending) return;
    const rating = await rateOutfit.mutateAsync({
      itemIds: current.items.map((i) => i.id),
    });
    router.push(`/rating/${rating.id}`);
  };

  const wearIt = async () => {
    if (!current) return;
    const result = await feedback.mutateAsync({
      itemIds: current.items.map((i) => i.id),
      liked: true,
    });
    await logWear.mutateAsync({ lookId: result.look.id, wornDate: todayISO() });
    setWornConfirmed(true);
  };

  const name = firstName(email);

  return (
    <Screen>
      <Text style={[theme.text.caption, { color: theme.colors.textMuted, marginBottom: 2 }]}>
        {greeting()}
        {name ? `, ${name}` : ''}
      </Text>
      <Text style={[theme.text.title, { color: theme.colors.text, marginBottom: 12 }]}>
        Today's fit
      </Text>

      {isLoading && (
        <View style={{ marginBottom: 16 }}>
          <Skeleton style={{ height: 78, borderRadius: theme.radius.lg }} />
        </View>
      )}
      {data?.weather && !isLoading && (
        <View style={{ marginBottom: 16 }}>
          <WeatherHeader weather={data.weather} />
        </View>
      )}

      {isLoading && <OutfitCardSkeleton />}

      {wornConfirmed && (
        <EmptyState
          emoji="🎉"
          title="Outfit logged!"
          message="Today's look is saved to your calendar. Check back tomorrow for fresh ideas."
          actionTitle="See calendar"
          onAction={() => router.push('/calendar')}
        />
      )}

      {!isLoading && !wornConfirmed && current && (
        <View style={styles.deck}>
          <OutfitCard
            key={cursor}
            suggestion={current}
            onLike={() => rate(true)}
            onDislike={() => rate(false)}
          />
          <View style={styles.actions}>
            <Button title="✕ Pass" variant="secondary" onPress={() => rate(false)} />
            <Button title="Wear this today" onPress={wearIt} loading={logWear.isPending} />
            <Button title="♥ Like" variant="secondary" onPress={() => rate(true)} />
          </View>
          <Button
            title={rateOutfit.isPending ? 'The jury is deliberating…' : '🗣️ What will people think?'}
            variant="outline"
            onPress={askTheJury}
            loading={rateOutfit.isPending}
          />
          <Text style={[theme.text.caption, { color: theme.colors.textMuted, textAlign: 'center' }]}>
            Swipe right to like, left to pass — LAM learns your taste.
          </Text>
        </View>
      )}

      {!isLoading && !wornConfirmed && !current && suggestions.length > 0 && (
        <EmptyState
          emoji="🧠"
          title="Got it — taste noted"
          message="You rated every suggestion. New combinations will be ready tomorrow."
          actionTitle="Start over"
          onAction={() => {
            setCursor(0);
            refetch();
          }}
        />
      )}

      {!isLoading && !wornConfirmed && suggestions.length === 0 && (
        <EmptyState
          emoji="🪞"
          title="No suggestions yet"
          message="Add a few tops and bottoms to your closet and LAM will start styling you."
          actionTitle="Capture an item"
          onAction={() => router.push('/capture')}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  deck: { gap: 14 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
});
