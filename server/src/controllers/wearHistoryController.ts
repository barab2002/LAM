import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/error';
import { getCurrentWeather } from '../services/weatherService';
import { toWearHistoryDto } from '../utils/serializers';

const listQuerySchema = z.object({
  // YYYY-MM — calendar month feed; defaults to the current month
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});

const logWearSchema = z.object({
  lookId: z.string(),
  wornDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  eventType: z.string().max(60).optional(),
  notes: z.string().max(500).optional(),
});

const LOOK_INCLUDE = { look: { include: { items: { include: { item: true } } } } } as const;

export async function listWearHistory(req: Request, res: Response): Promise<void> {
  const { month } = listQuerySchema.parse(req.query);
  const now = new Date();
  const [year, mon] = (month ?? `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`)
    .split('-')
    .map(Number);
  const start = new Date(Date.UTC(year, mon - 1, 1));
  const end = new Date(Date.UTC(year, mon, 1));

  const entries = await prisma.wearHistory.findMany({
    where: { userId: req.user!.id, wornDate: { gte: start, lt: end } },
    include: LOOK_INCLUDE,
    orderBy: { wornDate: 'asc' },
  });
  res.json(entries.map(toWearHistoryDto));
}

/**
 * Logs a look as worn on a date. Transactionally bumps wearCount and
 * lastWornDate for every item in the look — the data the decluttering
 * insights and anti-repeat logic run on.
 */
export async function logWear(req: Request, res: Response): Promise<void> {
  const data = logWearSchema.parse(req.body);
  const userId = req.user!.id;

  const look = await prisma.look.findFirst({
    where: { id: data.lookId, userId },
    include: { items: true },
  });
  if (!look) throw new HttpError(404, 'Look not found');

  const wornDate = new Date(`${data.wornDate}T00:00:00.000Z`);

  const existing = await prisma.wearHistory.findFirst({
    where: { userId, wornDate, lookId: data.lookId },
  });
  if (existing) throw new HttpError(409, 'This look is already logged for that date');

  // Best-effort weather snapshot for the day (used later for context)
  const user = req.user!;
  const weather =
    user.locationLat != null && user.locationLon != null
      ? await getCurrentWeather(user.locationLat, user.locationLon).catch(() => null)
      : null;

  const itemIds = look.items.map((li) => li.itemId);
  const [entry] = await prisma.$transaction([
    prisma.wearHistory.create({
      data: {
        userId,
        lookId: data.lookId,
        wornDate,
        eventType: data.eventType,
        notes: data.notes,
        weather: weather ? (weather as unknown as Prisma.InputJsonValue) : undefined,
      },
      include: LOOK_INCLUDE,
    }),
    prisma.clothingItem.updateMany({
      where: { id: { in: itemIds } },
      data: { wearCount: { increment: 1 }, lastWornDate: wornDate },
    }),
  ]);

  res.status(201).json(toWearHistoryDto(entry));
}

export async function deleteWearEntry(req: Request, res: Response): Promise<void> {
  const existing = await prisma.wearHistory.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
    include: { look: { include: { items: true } } },
  });
  if (!existing) throw new HttpError(404, 'Entry not found');

  const itemIds = existing.look?.items.map((li) => li.itemId) ?? [];
  await prisma.$transaction([
    prisma.wearHistory.delete({ where: { id: existing.id } }),
    ...(itemIds.length
      ? [
          prisma.clothingItem.updateMany({
            where: { id: { in: itemIds }, wearCount: { gt: 0 } },
            data: { wearCount: { decrement: 1 } },
          }),
        ]
      : []),
  ]);
  res.status(204).end();
}
