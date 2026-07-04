import { prisma } from '../lib/prisma';
import { colorPairKey } from './outfitScoring';

/** Learning rate for a single swipe. */
const LEARNING_RATE = 0.2;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Pure update rule — exported for unit tests. */
export function nextWeight(current: number, liked: boolean): number {
  return clamp(current + (liked ? LEARNING_RATE : -LEARNING_RATE), -1, 1);
}

/**
 * Applies one swipe (like/dislike) to every color pair present in the outfit.
 * Weights live in [-1, 1] and converge as the user keeps swiping.
 */
export async function applyFeedbackToColorPreferences(
  userId: string,
  outfitPrimaryColors: string[],
  liked: boolean,
): Promise<void> {
  const colors = [...new Set(outfitPrimaryColors.map((c) => c.toLowerCase()))];
  const pairs: [string, string][] = [];
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const [a, b] = [colors[i], colors[j]].sort();
      pairs.push([a, b]);
    }
  }

  for (const [colorA, colorB] of pairs) {
    const existing = await prisma.colorPreference.findUnique({
      where: { userId_colorA_colorB: { userId, colorA, colorB } },
    });
    await prisma.colorPreference.upsert({
      where: { userId_colorA_colorB: { userId, colorA, colorB } },
      update: {
        weight: nextWeight(existing?.weight ?? 0, liked),
        samples: { increment: 1 },
      },
      create: {
        userId,
        colorA,
        colorB,
        weight: nextWeight(0, liked),
        samples: 1,
      },
    });
  }
}

/** Loads the user's learned color-pair weights keyed by canonical pair. */
export async function getColorWeights(userId: string): Promise<Map<string, number>> {
  const prefs = await prisma.colorPreference.findMany({ where: { userId } });
  return new Map(prefs.map((p) => [colorPairKey(p.colorA, p.colorB), p.weight]));
}
