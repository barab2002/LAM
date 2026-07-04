import { Request, Response } from 'express';
import { ClothingItem, OutfitRating, Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/error';
import { getColorWeights } from '../services/preferenceService';
import { JuryItem, runStyleJury } from '../services/styleJuryService';
import { getCurrentWeather } from '../services/weatherService';
import type { OutfitRatingDto, PersonaReactionDto, WeatherSnapshot } from '../types/api';

const createRatingSchema = z
  .object({
    lookId: z.string().optional(),
    itemIds: z.array(z.string()).min(1).max(10).optional(),
    itemId: z.string().optional(),
    occasion: z.string().max(80).optional(),
  })
  .refine((d) => [d.lookId, d.itemIds, d.itemId].filter(Boolean).length === 1, {
    message: 'Provide exactly one of lookId, itemIds or itemId',
  });

function toRatingDto(rating: OutfitRating): OutfitRatingDto {
  return {
    id: rating.id,
    lookId: rating.lookId,
    overallScore: rating.overallScore,
    verdict: rating.verdict,
    personas: rating.personas as unknown as PersonaReactionDto[],
    source: rating.source,
    createdAt: rating.createdAt.toISOString(),
  };
}

function toJuryItem(item: ClothingItem): JuryItem {
  return {
    id: item.id,
    category: item.category,
    colors: item.colors,
    primaryColor: item.primaryColor,
    seasons: item.seasons,
    lastWornDate: item.lastWornDate,
    isFavorite: item.isFavorite,
    name: item.name,
    subcategory: item.subcategory,
    pattern: item.pattern,
    imageUrl: item.processedImageUrl ?? item.originalImageUrl,
  };
}

/**
 * POST /ratings — convene the Style Jury on a look, an ad-hoc item combo
 * (persisted as an AI_SUGGESTED look) or a single captured item.
 */
export async function createRating(req: Request, res: Response): Promise<void> {
  const data = createRatingSchema.parse(req.body);
  const user = req.user!;

  let lookId: string | null = null;
  let items: ClothingItem[];

  if (data.lookId) {
    const look = await prisma.look.findFirst({
      where: { id: data.lookId, userId: user.id },
      include: { items: { include: { item: true } } },
    });
    if (!look) throw new HttpError(404, 'Look not found');
    lookId = look.id;
    items = look.items.map((li) => li.item);
  } else if (data.itemIds) {
    const ids = [...new Set(data.itemIds)];
    items = await prisma.clothingItem.findMany({ where: { id: { in: ids }, userId: user.id } });
    if (items.length !== ids.length) {
      throw new HttpError(400, 'One or more items do not exist in your closet');
    }
    if (items.length > 1) {
      const look = await prisma.look.create({
        data: {
          userId: user.id,
          source: 'AI_SUGGESTED',
          items: { create: ids.map((itemId) => ({ itemId })) },
        },
      });
      lookId = look.id;
    }
  } else {
    const item = await prisma.clothingItem.findFirst({
      where: { id: data.itemId!, userId: user.id },
    });
    if (!item) throw new HttpError(404, 'Item not found');
    items = [item];
  }

  if (items.length === 0) throw new HttpError(400, 'Nothing to rate');

  let weather: WeatherSnapshot | null = null;
  if (user.locationLat != null && user.locationLon != null) {
    weather = await getCurrentWeather(user.locationLat, user.locationLon).catch(() => null);
  }

  const weights = await getColorWeights(user.id);
  const result = await runStyleJury(
    items.map(toJuryItem),
    { weather, occasion: data.occasion, bodyShape: user.bodyShape },
    weights,
  );

  const rating = await prisma.outfitRating.create({
    data: {
      userId: user.id,
      lookId,
      overallScore: result.overallScore,
      verdict: result.verdict,
      personas: result.personas as unknown as Prisma.InputJsonValue,
      source: result.source,
      context: {
        itemIds: items.map((i) => i.id),
        occasion: data.occasion ?? null,
        weather: weather as unknown as Prisma.JsonValue,
      } as Prisma.InputJsonValue,
    },
  });

  res.status(201).json(toRatingDto(rating));
}

export async function getRating(req: Request, res: Response): Promise<void> {
  const rating = await prisma.outfitRating.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
  });
  if (!rating) throw new HttpError(404, 'Rating not found');
  res.json(toRatingDto(rating));
}

export async function listRatings(req: Request, res: Response): Promise<void> {
  const lookId = typeof req.query.lookId === 'string' ? req.query.lookId : undefined;
  const ratings = await prisma.outfitRating.findMany({
    where: { userId: req.user!.id, ...(lookId ? { lookId } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  res.json(ratings.map(toRatingDto));
}
