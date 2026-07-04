import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/error';
import { toLookDto } from '../utils/serializers';

const createLookSchema = z.object({
  name: z.string().max(120).optional(),
  itemIds: z.array(z.string()).min(1).max(10),
  source: z.enum(['AI_SUGGESTED', 'USER_CREATED']).optional(),
  score: z.number().optional(),
});

const LOOK_INCLUDE = { items: { include: { item: true } } } as const;

export async function listLooks(req: Request, res: Response): Promise<void> {
  const looks = await prisma.look.findMany({
    where: { userId: req.user!.id },
    include: LOOK_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
  res.json(looks.map(toLookDto));
}

export async function getLook(req: Request, res: Response): Promise<void> {
  const look = await prisma.look.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
    include: LOOK_INCLUDE,
  });
  if (!look) throw new HttpError(404, 'Look not found');
  res.json(toLookDto(look));
}

export async function createLook(req: Request, res: Response): Promise<void> {
  const data = createLookSchema.parse(req.body);
  const userId = req.user!.id;

  const owned = await prisma.clothingItem.count({
    where: { id: { in: data.itemIds }, userId },
  });
  if (owned !== new Set(data.itemIds).size) {
    throw new HttpError(400, 'One or more items do not exist in your closet');
  }

  const look = await prisma.look.create({
    data: {
      userId,
      name: data.name,
      source: data.source ?? 'USER_CREATED',
      score: data.score,
      items: { create: [...new Set(data.itemIds)].map((itemId) => ({ itemId })) },
    },
    include: LOOK_INCLUDE,
  });
  res.status(201).json(toLookDto(look));
}

export async function deleteLook(req: Request, res: Response): Promise<void> {
  const existing = await prisma.look.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
    select: { id: true },
  });
  if (!existing) throw new HttpError(404, 'Look not found');
  await prisma.look.delete({ where: { id: existing.id } });
  res.status(204).end();
}
