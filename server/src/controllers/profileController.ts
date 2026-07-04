import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { toProfileDto } from '../utils/serializers';

const updateProfileSchema = z.object({
  displayName: z.string().max(120).optional(),
  bodyShape: z.enum(['HOURGLASS', 'PEAR', 'APPLE', 'RECTANGLE', 'INVERTED_TRIANGLE']).optional(),
  heightCm: z.number().int().min(50).max(260).optional(),
  weightKg: z.number().min(20).max(400).optional(),
  gender: z.enum(['FEMALE', 'MALE', 'NON_BINARY', 'UNSPECIFIED']).optional(),
  locationLat: z.number().min(-90).max(90).optional(),
  locationLon: z.number().min(-180).max(180).optional(),
  locationName: z.string().max(120).optional(),
  stylePrefs: z.record(z.unknown()).optional(),
});

export async function getProfile(req: Request, res: Response): Promise<void> {
  res.json(toProfileDto(req.user!));
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  const data = updateProfileSchema.parse(req.body);
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { ...data, stylePrefs: data.stylePrefs as Prisma.InputJsonValue | undefined },
  });
  res.json(toProfileDto(user));
}
