import { User } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import type { DailySuggestionsResponse, SuggestedLookDto, WeatherSnapshot } from '../types/api';
import { toItemDto } from '../utils/serializers';
import { getColorWeights } from './preferenceService';
import {
  generateCombos,
  itemSuitsWeather,
  outfitSignature,
  ScorableItem,
  scoreOutfit,
} from './outfitScoring';
import { getCurrentWeather } from './weatherService';

const SUGGESTION_COUNT = 5;

const MILD_FALLBACK_WEATHER: WeatherSnapshot = {
  tempC: 18,
  condition: 'partly-cloudy',
};

interface SuggestionContext {
  weather: WeatherSnapshot;
  dbItems: Awaited<ReturnType<typeof prisma.clothingItem.findMany>>;
  suitable: ScorableItem[];
  cold: boolean;
  warm: boolean;
  rainy: boolean;
  ctx: {
    learnedWeights: Map<string, number>;
    bodyShape: User['bodyShape'];
    now: Date;
    recentSignatures: Set<string>;
  };
}

/** Shared assembly for the daily-suggestion and item-pairing engines. */
async function assembleContext(
  user: User,
  latOverride?: number,
  lonOverride?: number,
): Promise<SuggestionContext> {
  const lat = latOverride ?? user.locationLat;
  const lon = lonOverride ?? user.locationLon;

  let weather = MILD_FALLBACK_WEATHER;
  if (lat != null && lon != null) {
    try {
      weather = await getCurrentWeather(lat, lon);
    } catch (err) {
      console.warn('[suggestions] weather fetch failed, using fallback:', (err as Error).message);
    }
  }

  const [dbItems, weights, recentWear] = await Promise.all([
    prisma.clothingItem.findMany({ where: { userId: user.id, isArchived: false } }),
    getColorWeights(user.id),
    prisma.wearHistory.findMany({
      where: {
        userId: user.id,
        wornDate: { gte: new Date(Date.now() - env.antiRepeatDays * 86_400_000) },
      },
      include: { look: { include: { items: true } } },
    }),
  ]);

  const recentSignatures = new Set(
    recentWear
      .filter((w) => w.look)
      .map((w) => outfitSignature(w.look!.items.map((li) => li.itemId))),
  );

  const items: ScorableItem[] = dbItems.map((i) => ({
    id: i.id,
    category: i.category,
    colors: i.colors,
    primaryColor: i.primaryColor,
    seasons: i.seasons,
    lastWornDate: i.lastWornDate,
    isFavorite: i.isFavorite,
  }));

  return {
    weather,
    dbItems,
    suitable: items.filter((i) => itemSuitsWeather(i, weather)),
    cold: weather.tempC < 15,
    warm: weather.tempC >= 22,
    rainy: ['rain', 'drizzle', 'thunderstorm', 'snow'].includes(weather.condition),
    ctx: {
      learnedWeights: weights,
      bodyShape: user.bodyShape,
      now: new Date(),
      recentSignatures,
    },
  };
}

function scoreAndRank(
  combos: ScorableItem[][],
  sc: SuggestionContext,
): { combo: ScorableItem[]; score: number; reasons: string[] }[] {
  const { weather, cold, rainy, ctx } = sc;
  return combos
    .map((combo) => {
      const result = scoreOutfit(combo, ctx);
      if (!result) return null;
      const reasons = [...result.reasons];
      if (cold && combo.some((i) => i.category === 'OUTERWEAR')) {
        reasons.push(`Layered for ${Math.round(weather.tempC)}°C`);
      }
      if (rainy && combo.some((i) => i.category === 'OUTERWEAR')) {
        reasons.push('Covered for wet weather');
      }
      return { combo, score: result.score, reasons };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => b.score - a.score);
}

/**
 * Daily outfit suggestions:
 *  weather → weather-appropriate closet subset → candidate combos →
 *  score (learned color prefs + body shape + freshness) → drop recently worn →
 *  top N with human-readable reasons.
 */
export async function getDailySuggestions(
  user: User,
  latOverride?: number,
  lonOverride?: number,
): Promise<DailySuggestionsResponse> {
  const sc = await assembleContext(user, latOverride, lonOverride);
  const { weather, dbItems, suitable, cold, warm } = sc;

  const combos = generateCombos(suitable, {
    requireOuterwear: cold,
    allowOuterwear: !warm,
  });

  const scored = scoreAndRank(combos, sc);

  // Diversify: avoid the top-5 all sharing the same base garment
  const picked: typeof scored = [];
  const baseUse = new Map<string, number>();
  for (const candidate of scored) {
    if (picked.length >= SUGGESTION_COUNT) break;
    const overused = candidate.combo.some((i) => (baseUse.get(i.id) ?? 0) >= 2);
    if (overused) continue;
    picked.push(candidate);
    for (const i of candidate.combo) baseUse.set(i.id, (baseUse.get(i.id) ?? 0) + 1);
  }

  const dbItemById = new Map(dbItems.map((i) => [i.id, i]));
  const suggestions: SuggestedLookDto[] = picked.map((p) => ({
    lookId: null,
    items: p.combo.map((i) => toItemDto(dbItemById.get(i.id)!)),
    score: p.score,
    reasons: [...new Set(p.reasons)].slice(0, 4),
  }));

  return { weather, suggestions };
}

const PAIRING_COUNT = 6;
const COMBO_CATEGORIES = new Set(['TOP', 'BOTTOM', 'DRESS', 'OUTERWEAR', 'SHOES']);

/**
 * "Best to go with": outfit combinations anchored on one garment, ranked by
 * the same engine as daily suggestions. Anchors in the combo-generating
 * categories replace their category's candidate list (guaranteeing
 * inclusion); accessories/bags are appended to every combo.
 */
export async function getPairingsForItem(
  user: User,
  itemId: string,
): Promise<SuggestedLookDto[] | null> {
  const sc = await assembleContext(user);
  const { dbItems, suitable, warm } = sc;

  const anchorDb = dbItems.find((i) => i.id === itemId);
  if (!anchorDb) return null;

  const anchor: ScorableItem = {
    id: anchorDb.id,
    category: anchorDb.category,
    colors: anchorDb.colors,
    primaryColor: anchorDb.primaryColor,
    seasons: anchorDb.seasons,
    lastWornDate: anchorDb.lastWornDate,
    isFavorite: anchorDb.isFavorite,
  };

  let combos: ScorableItem[][];
  if (COMBO_CATEGORIES.has(anchor.category)) {
    // The anchor becomes its category's only candidate (weather rules are
    // relaxed for it — the user explicitly asked about this piece).
    const pool = suitable.filter((i) => i.category !== anchor.category && i.id !== anchor.id);
    combos = generateCombos([...pool, anchor], {
      // Don't force outerwear when the anchor IS the outfit's base
      requireOuterwear: sc.cold && anchor.category !== 'DRESS',
      allowOuterwear: !warm || anchor.category === 'OUTERWEAR',
    }).filter((combo) => combo.some((i) => i.id === anchor.id));
    // DRESS anchors also exclude top+bottom bases (a dress replaces both)
    if (anchor.category === 'DRESS') {
      combos = combos.filter((combo) => !combo.some((i) => i.category === 'TOP'));
    }
  } else {
    // ACCESSORY / BAG: ride along on regular outfits
    const pool = suitable.filter((i) => i.id !== anchor.id);
    combos = generateCombos(pool, {
      requireOuterwear: sc.cold,
      allowOuterwear: !warm,
    }).map((combo) => [...combo, anchor]);
  }

  const scored = scoreAndRank(combos, sc);

  // Diversify partners so the list isn't six variations of one pants
  const picked: typeof scored = [];
  const partnerUse = new Map<string, number>();
  for (const candidate of scored) {
    if (picked.length >= PAIRING_COUNT) break;
    const partners = candidate.combo.filter((i) => i.id !== anchor.id);
    if (partners.some((i) => (partnerUse.get(i.id) ?? 0) >= 2)) continue;
    picked.push(candidate);
    for (const i of partners) partnerUse.set(i.id, (partnerUse.get(i.id) ?? 0) + 1);
  }

  const dbItemById = new Map(dbItems.map((i) => [i.id, i]));
  return picked.map((p) => ({
    lookId: null,
    items: p.combo.map((i) => toItemDto(dbItemById.get(i.id)!)),
    score: p.score,
    reasons: [...new Set(p.reasons)].slice(0, 4),
  }));
}
