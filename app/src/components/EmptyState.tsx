import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { motion, useTheme } from '../theme';
import { Button } from './Button';
import { Icon, IconName } from './Icon';

interface EmptyStateProps {
  icon: IconName;
  title: string;
  message: string;
  actionTitle?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, message, actionTitle, onAction }: EmptyStateProps) {
  const theme = useTheme();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.92);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: motion.duration.slow, easing: motion.easing });
    scale.value = withTiming(1, { duration: motion.duration.slow, easing: motion.easing });
  }, [opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <View style={[styles.iconChip, { backgroundColor: theme.colors.accentMuted }]}>
        <Icon name={icon} size={theme.iconSize.xl} color={theme.colors.accent} />
      </View>
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 12, paddingVertical: 48 },
  iconChip: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
});
