import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/error';
import { applyFeedbackToColorPreferences } from '../services/preferenceService';
import { getDailySuggestions } from '../services/suggestionService';
import { toLookDto } from '../utils/serializers';

const suggestionsQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lon: z.coerce.number().min(-180).max(180).optional(),
});

const feedbackSchema = z
  .object({
    lookId: z.string().optional(),
    itemIds: z.array(z.string()).min(1).max(10).optional(),
    liked: z.boolean(),
  })
  .refine((d) => d.lookId || d.itemIds?.length, {
    message: 'Provide lookId or itemIds',
  });

export async function dailySuggestions(req: Request, res: Response): Promise<void> {
  const { lat, lon } = suggestionsQuerySchema.parse(req.query);
  const result = await getDailySuggestions(req.user!, lat, lon);
  res.json(result);
}

/**
 * Swipe feedback. For raw item combinations (suggestions the user just rated)
 * a Look is persisted first so feedback always references a Look, then the
 * color-pair weights are updated.
 */
export async function submitFeedback(req: Request, res: Response): Promise<void> {
  const data = feedbackSchema.parse(req.body);
  const userId = req.user!.id;

  let lookId = data.lookId ?? null;
  let itemIds: string[];

  if (lookId) {
    const look = await prisma.look.findFirst({
      where: { id: lookId, userId },
      include: { items: true },
    });
    if (!look) throw new HttpError(404, 'Look not found');
    itemIds = look.items.map((li) => li.itemId);
  } else {
    itemIds = [...new Set(data.itemIds!)];
    const owned = await prisma.clothingItem.count({ where: { id: { in: itemIds }, userId } });
    if (owned !== itemIds.length) {
      throw new HttpError(400, 'One or more items do not exist in your closet');
    }
    const look = await prisma.look.create({
      data: {
        userId,
        source: 'AI_SUGGESTED',
        items: { create: itemIds.map((itemId) => ({ itemId })) },
      },
      include: { items: { include: { item: true } } },
    });
    lookId = look.id;
  }

  await prisma.outfitFeedback.create({
    data: { userId, lookId, liked: data.liked, context: { itemIds } },
  });

  const items = await prisma.clothingItem.findMany({
    where: { id: { in: itemIds } },
    select: { primaryColor: true, colors: true },
  });
  const primaryColors = items
    .map((i) => i.primaryColor ?? i.colors[0])
    .filter((c): c is string => Boolean(c));
  await applyFeedbackToColorPreferences(userId, primaryColors, data.liked);

  const look = await prisma.look.findUniqueOrThrow({
    where: { id: lookId },
    include: { items: { include: { item: true } } },
  });
  res.status(201).json({ look: toLookDto(look), liked: data.liked });
}
