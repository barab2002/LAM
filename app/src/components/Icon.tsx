import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import type { ComponentProps } from 'react';
import { useTheme } from '../theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

/** Consistent Ionicons wrapper — defaults to the theme's text color and md icon size. */
export function Icon({ name, size, color }: IconProps) {
  const theme = useTheme();
  return <Ionicons name={name} size={size ?? theme.iconSize.md} color={color ?? theme.colors.text} />;
}
