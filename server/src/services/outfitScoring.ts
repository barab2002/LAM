/**
 * Pure outfit-scoring logic — no I/O, fully unit-testable.
 * The suggestion engine composes these functions with DB/weather data.
 */
import type { ClothingCategory, Season, WeatherSnapshot } from '../types/api';

export interface ScorableItem {
  id: string;
  category: ClothingCategory;
  colors: string[];
  primaryColor: string | null;
  seasons: Season[];
  lastWornDate: Date | null;
  isFavorite: boolean;
}

export interface OutfitScore {
  score: number;
  reasons: string[];
}

export type BodyShape =
  | 'HOURGLASS'
  | 'PEAR'
  | 'APPLE'
  | 'RECTANGLE'
  | 'INVERTED_TRIANGLE';

const NEUTRALS = new Set([
  'black',
  'white',
  'gray',
  'grey',
  'beige',
  'cream',
  'tan',
  'navy',
  'brown',
  'denim',
  'khaki',
]);

const DARK_COLORS = new Set(['black', 'navy', 'brown', 'charcoal', 'burgundy', 'dark-green']);

// Classic combinations that read well before any learning has happened
const CLASSIC_PAIRS = new Set([
  'blue|white',
  'black|red',
  'navy|white',
  'pink|gray',
  'green|beige',
  'denim|white',
  'black|gold',
]);

/** Canonical unordered color-pair key, e.g. key("white","blue") === "blue|white" */
export function colorPairKey(a: string, b: string): string {
  const [x, y] = [a.toLowerCase(), b.toLowerCase()].sort();
  return `${x}|${y}`;
}

/** All unique canonical pairs across the outfit's primary colors. */
export function outfitColorPairs(items: ScorableItem[]): string[] {
  const colors = items
    .map((i) => i.primaryColor ?? i.colors[0])
    .filter((c): c is string => Boolean(c))
    .map((c) => c.toLowerCase());
  const pairs = new Set<string>();
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      if (colors[i] !== colors[j]) pairs.add(colorPairKey(colors[i], colors[j]));
    }
  }
  return [...pairs];
}

/**
 * Color harmony = learned pairwise weights (dominant term once the user has
 * swiped enough) + baseline heuristics (neutrals pair with anything, classic
 * combos, monochrome).
 */
export function scoreColorHarmony(
  items: ScorableItem[],
  learnedWeights: ReadonlyMap<string, number>,
): OutfitScore {
  const reasons: string[] = [];
  let score = 0;

  const pairs = outfitColorPairs(items);
  for (const pair of pairs) {
    const learned = learnedWeights.get(pair);
    if (learned !== undefined && learned !== 0) {
      score += learned * 0.4;
      if (learned > 0.3) reasons.push(`You like ${pair.replace('|', ' + ')}`);
      continue;
    }
    const [a, b] = pair.split('|');
    if (NEUTRALS.has(a) || NEUTRALS.has(b)) {
      score += 0.12;
    } else if (CLASSIC_PAIRS.has(pair)) {
      score += 0.15;
      reasons.push(`Classic combo: ${a} + ${b}`);
    } else {
      score -= 0.05; // two unrelated saturated colors — mild risk
    }
  }

  // Monochrome / single-color outfits read intentional — but only when every
  // piece actually has a known color (untagged items don't make a palette)
  const knownColors = items
    .map((i) => (i.primaryColor ?? i.colors[0])?.toLowerCase())
    .filter((c): c is string => Boolean(c));
  const distinct = new Set(knownColors);
  if (distinct.size === 1 && knownColors.length === items.length && items.length > 1) {
    score += 0.15;
    reasons.push('Monochrome look');
  }

  return { score, reasons };
}

/**
 * Body-shape styling rules (coarse, category/color-level heuristics).
 */
export function scoreBodyShapeFit(items: ScorableItem[], bodyShape: BodyShape | null): OutfitScore {
  if (!bodyShape) return { score: 0, reasons: [] };
  const reasons: string[] = [];
  let score = 0;

  const top = items.find((i) => i.category === 'TOP');
  const bottom = items.find((i) => i.category === 'BOTTOM');
  const dress = items.find((i) => i.category === 'DRESS');
  const outerwear = items.find((i) => i.category === 'OUTERWEAR');

  const isDark = (item: ScorableItem | undefined) =>
    !!item && DARK_COLORS.has((item.primaryColor ?? item.colors[0] ?? '').toLowerCase());

  switch (bodyShape) {
    case 'PEAR':
      // Balance: draw the eye up — brighter top, darker bottom
      if (bottom && isDark(bottom) && top && !isDark(top)) {
        score += 0.2;
        reasons.push('Bright top + dark bottom flatters a pear shape');
      }
      break;
    case 'INVERTED_TRIANGLE':
      // Opposite: soften shoulders, add interest below
      if (top && isDark(top) && bottom && !isDark(bottom)) {
        score += 0.2;
        reasons.push('Dark top + lighter bottom balances broad shoulders');
      }
      break;
    case 'APPLE':
      // Elongate: dresses and open layers work well
      if (dress || outerwear) {
        score += 0.15;
        reasons.push('Elongating silhouette for an apple shape');
      }
      break;
    case 'RECTANGLE':
      // Create shape through layering
      if (outerwear) {
        score += 0.15;
        reasons.push('Layering adds definition');
      }
      break;
    case 'HOURGLASS':
      // Fitted single pieces show the waist
      if (dress) {
        score += 0.15;
        reasons.push('A dress shows off an hourglass shape');
      }
      break;
  }
  return { score, reasons };
}

/** Seasons appropriate for a temperature (°C). */
export function seasonsForTemperature(tempC: number): Season[] {
  if (tempC >= 24) return ['SUMMER'];
  if (tempC >= 16) return ['SPRING', 'SUMMER'];
  if (tempC >= 8) return ['SPRING', 'FALL'];
  return ['WINTER', 'FALL'];
}

/** Whether an item suits the weather (untagged seasons = all-season). */
export function itemSuitsWeather(item: ScorableItem, weather: WeatherSnapshot): boolean {
  if (item.seasons.length === 0 || item.seasons.length === 4) return true;
  const wanted = seasonsForTemperature(weather.tempC);
  return item.seasons.some((s) => wanted.includes(s));
}

/**
 * Freshness: items worn very recently are penalized so the closet rotates.
 * Favorites get a small standing boost.
 */
export function scoreFreshness(items: ScorableItem[], now: Date, windowDays = 14): OutfitScore {
  const reasons: string[] = [];
  let score = 0;
  let stale = 0;

  for (const item of items) {
    if (item.isFavorite) score += 0.05;
    if (!item.lastWornDate) {
      score += 0.08; // encourage never-worn items into rotation
      continue;
    }
    const days = (now.getTime() - item.lastWornDate.getTime()) / 86_400_000;
    if (days < windowDays) {
      score -= ((windowDays - days) / windowDays) * 0.25;
      stale++;
    }
  }
  if (stale === 0 && items.some((i) => !i.lastWornDate)) {
    reasons.push('Puts unworn pieces into rotation');
  }
  return { score, reasons };
}

export interface ComboOptions {
  requireOuterwear: boolean;
  allowOuterwear: boolean;
  maxCombos?: number;
}

/**
 * Generates candidate outfits: (top+bottom | dress) [+outerwear] [+shoes].
 * Bounded to keep scoring cheap on large closets.
 */
export function generateCombos(items: ScorableItem[], opts: ComboOptions): ScorableItem[][] {
  const byCat = (cat: ClothingCategory) => items.filter((i) => i.category === cat);
  const tops = byCat('TOP');
  const bottoms = byCat('BOTTOM');
  const dresses = byCat('DRESS');
  const outer = byCat('OUTERWEAR');
  const shoes = byCat('SHOES');
  const maxCombos = opts.maxCombos ?? 400;

  const bases: ScorableItem[][] = [];
  for (const top of tops) {
    for (const bottom of bottoms) {
      bases.push([top, bottom]);
    }
  }
  for (const dress of dresses) bases.push([dress]);

  const combos: ScorableItem[][] = [];
  outer_loop: for (const base of bases) {
    const layered: ScorableItem[][] = [];
    if (opts.requireOuterwear) {
      if (outer.length === 0) continue;
      for (const o of outer) layered.push([...base, o]);
    } else {
      layered.push(base);
      if (opts.allowOuterwear) for (const o of outer) layered.push([...base, o]);
    }

    for (const combo of layered) {
      if (shoes.length === 0) {
        combos.push(combo);
        if (combos.length >= maxCombos) break outer_loop;
      } else {
        for (const s of shoes) {
          combos.push([...combo, s]);
          if (combos.length >= maxCombos) break outer_loop;
        }
      }
    }
  }
  return combos;
}

/** Stable signature for a set of items — used for anti-repeat comparison. */
export function outfitSignature(itemIds: string[]): string {
  return [...itemIds].sort().join(',');
}

export interface ScoreContext {
  learnedWeights: ReadonlyMap<string, number>;
  bodyShape: BodyShape | null;
  now: Date;
  /** Signatures of outfits worn within the anti-repeat window */
  recentSignatures: ReadonlySet<string>;
}

/** Full outfit score. Returns null when the outfit was recently worn (hard exclude). */
export function scoreOutfit(items: ScorableItem[], ctx: ScoreContext): OutfitScore | null {
  if (ctx.recentSignatures.has(outfitSignature(items.map((i) => i.id)))) return null;

  const color = scoreColorHarmony(items, ctx.learnedWeights);
  const body = scoreBodyShapeFit(items, ctx.bodyShape);
  const fresh = scoreFreshness(items, ctx.now);

  return {
    score: Number((0.5 + color.score + body.score + fresh.score).toFixed(4)),
    reasons: [...color.reasons, ...body.reasons, ...fresh.reasons],
  };
}
