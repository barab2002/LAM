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

  const suitable = items.filter((i) => itemSuitsWeather(i, weather));
  const cold = weather.tempC < 15;
  const warm = weather.tempC >= 22;
  const rainy = ['rain', 'drizzle', 'thunderstorm', 'snow'].includes(weather.condition);

  const combos = generateCombos(suitable, {
    requireOuterwear: cold,
    allowOuterwear: !warm,
  });

  const ctx = {
    learnedWeights: weights,
    bodyShape: user.bodyShape,
    now: new Date(),
    recentSignatures,
  };

  const scored = combos
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
