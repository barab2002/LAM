import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { motion, useTheme } from '../theme';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

export function Chip({ label, selected, onPress }: ChipProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        onPressIn={() => {
          scale.value = withTiming(0.95, { duration: motion.duration.fast });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: motion.duration.fast });
        }}
        style={[
          styles.chip,
          {
            backgroundColor: selected ? theme.colors.accent : theme.colors.surfaceSunken,
            borderColor: selected ? theme.colors.accent : theme.colors.border,
            borderRadius: theme.radius.full,
          },
        ]}
      >
        <Text
          style={[
            theme.text.label,
            { color: selected ? theme.colors.onAccent : theme.colors.textMuted },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    marginRight: 8,
  },
});
