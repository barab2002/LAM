import { GestureHoldDetector, isVGesture, Landmark } from './gesture';

/**
 * Synthetic hand: wrist at (0.5, 0.9), fingers fan upward.
 * Helper places each finger either extended (tip far above pip) or folded
 * (tip curled back near the palm).
 */
function hand(fingers: {
  index: 'up' | 'down';
  middle: 'up' | 'down';
  ring: 'up' | 'down';
  pinky: 'up' | 'down';
  spread?: number; // horizontal gap between index & middle tips
}): Landmark[] {
  const lm: Landmark[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.9 }));
  const spread = fingers.spread ?? 0.12;

  // finger: [mcp, pip, dip, tip] landmark indices + base x position
  const defs: [keyof typeof fingers, number[], number][] = [
    ['index', [5, 6, 7, 8], 0.42],
    ['middle', [9, 10, 11, 12], 0.5],
    ['ring', [13, 14, 15, 16], 0.58],
    ['pinky', [17, 18, 19, 20], 0.66],
  ];

  for (const [name, [mcp, pip, dip, tip], x] of defs) {
    const state = fingers[name] as 'up' | 'down';
    lm[mcp] = { x, y: 0.6 };
    lm[pip] = { x, y: 0.5 };
    if (state === 'up') {
      lm[dip] = { x, y: 0.38 };
      lm[tip] = { x, y: 0.28 };
    } else {
      // curled: tip drops back toward the palm
      lm[dip] = { x, y: 0.58 };
      lm[tip] = { x, y: 0.68 };
    }
  }

  // Apply V-spread to index & middle tips
  if (fingers.index === 'up' && fingers.middle === 'up') {
    lm[8] = { x: 0.42 - spread / 2, y: 0.28 };
    lm[12] = { x: 0.5 + spread / 2, y: 0.28 };
  }
  return lm;
}

describe('isVGesture', () => {
  it('recognizes a proper V (index+middle up, ring+pinky folded)', () => {
    expect(isVGesture(hand({ index: 'up', middle: 'up', ring: 'down', pinky: 'down' }))).toBe(true);
  });

  it('rejects an open palm (all fingers up)', () => {
    expect(isVGesture(hand({ index: 'up', middle: 'up', ring: 'up', pinky: 'up' }))).toBe(false);
  });

  it('rejects a fist (all fingers folded)', () => {
    expect(isVGesture(hand({ index: 'down', middle: 'down', ring: 'down', pinky: 'down' }))).toBe(
      false,
    );
  });

  it('rejects a pointing finger (only index up)', () => {
    expect(isVGesture(hand({ index: 'up', middle: 'down', ring: 'down', pinky: 'down' }))).toBe(
      false,
    );
  });

  it('rejects fingers held tightly together (no V spread)', () => {
    expect(
      isVGesture(hand({ index: 'up', middle: 'up', ring: 'down', pinky: 'down', spread: 0.0 })),
    ).toBe(false);
  });

  it('rejects malformed input', () => {
    expect(isVGesture([])).toBe(false);
    expect(isVGesture([{ x: 0, y: 0 }])).toBe(false);
  });
});

describe('GestureHoldDetector', () => {
  it('fires once after the hold duration and not before', () => {
    const fired: number[] = [];
    const detector = new GestureHoldDetector(500, () => fired.push(1));

    detector.update(true, 0);
    detector.update(true, 300);
    expect(fired).toHaveLength(0);

    detector.update(true, 520);
    expect(fired).toHaveLength(1);

    // Keeps quiet while held
    detector.update(true, 900);
    detector.update(true, 2000);
    expect(fired).toHaveLength(1);
  });

  it('resets when the gesture breaks', () => {
    const fired: number[] = [];
    const detector = new GestureHoldDetector(500, () => fired.push(1));

    detector.update(true, 0);
    detector.update(false, 300); // dropped the gesture
    detector.update(true, 400);
    detector.update(true, 700); // only held 300ms since re-start
    expect(fired).toHaveLength(0);

    detector.update(true, 950);
    expect(fired).toHaveLength(1);

    // After relaxing, it can fire again
    detector.update(false, 1000);
    detector.update(true, 1100);
    detector.update(true, 1700);
    expect(fired).toHaveLength(2);
  });
});
