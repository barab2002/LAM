/**
 * "V" (peace-sign) gesture classifier over MediaPipe hand landmarks.
 *
 * Pure TypeScript so the exact same logic runs against:
 *  - @mediapipe/tasks-vision HandLandmarker results on web
 *  - a hand-landmark model in a native frame processor
 *
 * MediaPipe hand landmark indices:
 * 0 wrist · 4 thumb tip · 5/6/8 index mcp/pip/tip · 9/10/12 middle ·
 * 13/14/16 ring · 17/18/20 pinky
 */

export interface Landmark {
  x: number;
  y: number;
  z?: number;
}

const WRIST = 0;
const INDEX = { pip: 6, tip: 8 };
const MIDDLE = { pip: 10, tip: 12 };
const RING = { pip: 14, tip: 16 };
const PINKY = { pip: 18, tip: 20 };

function dist(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function fingerExtended(landmarks: Landmark[], finger: { pip: number; tip: number }): boolean {
  const wrist = landmarks[WRIST];
  // A straight finger puts its tip clearly further from the wrist than its PIP
  return dist(landmarks[finger.tip], wrist) > dist(landmarks[finger.pip], wrist) * 1.25;
}

function fingerFolded(landmarks: Landmark[], finger: { pip: number; tip: number }): boolean {
  const wrist = landmarks[WRIST];
  return dist(landmarks[finger.tip], wrist) < dist(landmarks[finger.pip], wrist) * 1.05;
}

/**
 * True when the hand shows a "V": index + middle extended and spread,
 * ring + pinky folded.
 */
export function isVGesture(landmarks: Landmark[]): boolean {
  if (!landmarks || landmarks.length < 21) return false;

  const indexUp = fingerExtended(landmarks, INDEX);
  const middleUp = fingerExtended(landmarks, MIDDLE);
  const ringDown = fingerFolded(landmarks, RING);
  const pinkyDown = fingerFolded(landmarks, PINKY);
  if (!indexUp || !middleUp || !ringDown || !pinkyDown) return false;

  // The two raised fingers must actually be spread into a V,
  // not held together (that would be a "two" in some styles, still fine)
  const tipSpread = dist(landmarks[INDEX.tip], landmarks[MIDDLE.tip]);
  const pipSpread = dist(landmarks[INDEX.pip], landmarks[MIDDLE.pip]);
  return tipSpread > pipSpread * 1.1;
}

/**
 * Debounces the gesture: fires `onHold` once the gesture has been held
 * continuously for `holdMs`, then stays quiet until the hand relaxes.
 */
export class GestureHoldDetector {
  private heldSince: number | null = null;
  private fired = false;

  constructor(
    private readonly holdMs = 500,
    private readonly onHold: () => void,
  ) {}

  update(gestureActive: boolean, nowMs: number): void {
    if (!gestureActive) {
      this.heldSince = null;
      this.fired = false;
      return;
    }
    if (this.heldSince === null) this.heldSince = nowMs;
    if (!this.fired && nowMs - this.heldSince >= this.holdMs) {
      this.fired = true;
      this.onHold();
    }
  }

  reset(): void {
    this.heldSince = null;
    this.fired = false;
  }
}
