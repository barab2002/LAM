import { Image } from 'expo-image';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { useWearHistory } from '../../api/hooks';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../theme';

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export default function CalendarScreen() {
  const theme = useTheme();
  const [month, setMonth] = useState(currentMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const { data: history } = useWearHistory(month);

  const marked = useMemo(() => {
    const marks: Record<string, object> = {};
    for (const entry of history ?? []) {
      marks[entry.wornDate] = {
        marked: true,
        dotColor: theme.colors.accent,
      };
    }
    if (selectedDay) {
      marks[selectedDay] = {
        ...(marks[selectedDay] ?? {}),
        selected: true,
        selectedColor: theme.colors.accent,
      };
    }
    return marks;
  }, [history, selectedDay, theme]);

  const dayEntries = (history ?? []).filter((e) => e.wornDate === selectedDay);

  return (
    <Screen>
      <Text style={[theme.text.title, { color: theme.colors.text, marginBottom: 12 }]}>
        Outfit calendar
      </Text>

      <View
        style={[
          styles.calendarWrap,
          { borderColor: theme.colors.border, borderRadius: theme.radius.md },
        ]}
      >
        <Calendar
          key={theme.dark ? 'dark' : 'light'}
          onDayPress={(day: DateData) => setSelectedDay(day.dateString)}
          onMonthChange={(day: DateData) => setMonth(day.dateString.slice(0, 7))}
          markedDates={marked}
          theme={{
            calendarBackground: theme.colors.card,
            dayTextColor: theme.colors.text,
            monthTextColor: theme.colors.text,
            textSectionTitleColor: theme.colors.textMuted,
            todayTextColor: theme.colors.accent,
            arrowColor: theme.colors.accent,
            textDisabledColor: theme.colors.border,
          }}
        />
      </View>

      {selectedDay && dayEntries.length === 0 && (
        <Text
          style={[
            theme.text.body,
            { color: theme.colors.textMuted, textAlign: 'center', marginTop: 20 },
          ]}
        >
          Nothing logged on {selectedDay}.
        </Text>
      )}

      {dayEntries.map((entry) => (
        <View
          key={entry.id}
          style={[
            styles.entry,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.md,
            },
          ]}
        >
          <Text style={[theme.text.heading, { color: theme.colors.text }]}>
            {entry.look?.name ?? 'Worn look'}
            {entry.eventType ? `  ·  ${entry.eventType}` : ''}
          </Text>
          <View style={styles.entryImages}>
            {entry.look?.items.map((item) => (
              <Image
                key={item.id}
                source={item.processedImageUrl ?? item.originalImageUrl}
                style={[styles.entryImage, { backgroundColor: theme.colors.cardPressed }]}
                contentFit="contain"
              />
            ))}
          </View>
          {entry.weather && (
            <Text style={[theme.text.caption, { color: theme.colors.textMuted }]}>
              {Math.round(entry.weather.tempC)}°C · {entry.weather.condition}
            </Text>
          )}
        </View>
      ))}

      {!selectedDay && (history ?? []).length === 0 && (
        <EmptyState
          emoji="🗓️"
          title="No outfits logged yet"
          message="When you wear a suggested look (or log one yourself), it lands here so you never repeat an outfit two events in a row."
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  calendarWrap: { borderWidth: 1, overflow: 'hidden' },
  entry: { borderWidth: 1, padding: 14, gap: 10, marginTop: 14 },
  entryImages: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  entryImage: { width: 84, height: 100, borderRadius: 8 },
});
