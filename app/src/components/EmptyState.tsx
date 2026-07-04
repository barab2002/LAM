import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { Button } from './Button';

interface EmptyStateProps {
  emoji: string;
  title: string;
  message: string;
  actionTitle?: string;
  onAction?: () => void;
}

export function EmptyState({ emoji, title, message, actionTitle, onAction }: EmptyStateProps) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[theme.text.heading, { color: theme.colors.text, textAlign: 'center' }]}>
        {title}
      </Text>
      <Text
        style={[
          theme.text.body,
          { color: theme.colors.textMuted, textAlign: 'center', maxWidth: 280 },
        ]}
      >
        {message}
      </Text>
      {actionTitle && onAction && (
        <View style={{ marginTop: theme.spacing(2) }}>
          <Button title={actionTitle} onPress={onAction} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 10, paddingVertical: 48 },
  emoji: { fontSize: 44 },
});
