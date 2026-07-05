import React from 'react';
import Svg, { Path } from 'react-native-svg';
import type { BodyShape } from '../types/api';

/**
 * Small hand-drawn abstract torso silhouettes for the 5 body shapes.
 * Stroke-only (no fill) so callers can recolor for selected/unselected state,
 * unlike static emoji.
 */
const PATHS: Record<BodyShape, string> = {
  // Wide shoulders/hips, pinched waist
  HOURGLASS:
    'M4,5 L20,5 C20,9 15,12 15,16 C15,20 20,23 20,27 L4,27 C4,23 9,20 9,16 C9,12 4,9 4,5 Z',
  // Narrow shoulders widening to full hips
  PEAR: 'M8.5,5 L15.5,5 C16.5,9 18,12 18,16 C18,20 20,23 20,27 L4,27 C4,23 6,20 6,16 C6,12 7.5,9 8.5,5 Z',
  // Full shoulders/middle, narrower hips
  APPLE:
    'M5,5 L19,5 C19.5,8 19.5,11 19.5,13 C19.5,17 18,22 16.5,27 L7.5,27 C6,22 4.5,17 4.5,13 C4.5,11 4.5,8 5,5 Z',
  // Straight sides, similar bust/waist/hip
  RECTANGLE: 'M6,5 L18,5 C18.5,12 18.5,20 18,27 L6,27 C5.5,20 5.5,12 6,5 Z',
  // Wide shoulders tapering to narrow hips
  INVERTED_TRIANGLE:
    'M4,5 L20,5 C19.5,12 18,20 15.5,27 L8.5,27 C6,20 4.5,12 4,5 Z',
};

interface BodyShapeIconProps {
  shape: BodyShape;
  size?: number;
  color: string;
}

export function BodyShapeIcon({ shape, size = 32, color }: BodyShapeIconProps) {
  return (
    <Svg width={size} height={(size * 32) / 24} viewBox="0 0 24 32">
      <Path
        d={PATHS[shape]}
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
