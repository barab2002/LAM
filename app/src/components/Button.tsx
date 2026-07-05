import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { tapHaptic } from '../lib/haptics';
import { motion, useTheme } from '../theme';
import { Icon, IconName } from './Icon';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
  icon?: IconName;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  compact,
  icon,
}: ButtonProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);

  const background =
    variant === 'primary'
      ? theme.colors.accent
      : variant === 'danger'
        ? theme.colors.danger
        : variant === 'secondary'
          ? theme.colors.card
          : variant === 'outline'
            ? theme.colors.accentMuted
            : 'transparent';
  const color =
    variant === 'primary' || variant === 'danger'
      ? theme.colors.onAccent
      : variant === 'ghost' || variant === 'outline'
        ? theme.colors.accent
        : theme.colors.text;
  const borderColor = variant === 'outline' ? theme.colors.accent : theme.colors.border;

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          tapHaptic(variant === 'primary' ? 'medium' : 'light');
          onPress();
        }}
        onPressIn={() => {
          scale.value = withTiming(0.97, { duration: motion.duration.fast });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: motion.duration.fast });
        }}
        disabled={disabled || loading}
        style={[
          styles.base,
          compact && styles.compact,
          variant === 'primary' && theme.shadow('sm'),
          {
            backgroundColor: background,
            borderRadius: theme.radius.full,
            borderWidth: variant === 'secondary' || variant === 'outline' ? 1 : 0,
            borderColor,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={color} />
        ) : (
          <View style={styles.content}>
            {icon && <Icon name={icon} size={compact ? 15 : 17} color={color} />}
            <Text style={[theme.text.label, { color, fontSize: compact ? 13 : 15 }]}>{title}</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    minHeight: 48,
  },
  compact: { paddingVertical: 8, paddingHorizontal: 16, minHeight: 36 },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
