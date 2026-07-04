import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import type { DeclutterItemDto } from '../types/api';
import { toItemDto } from '../utils/serializers';

const STALE_MONTHS = 6;
const LOW_WEAR_THRESHOLD = 2;
const MIN_OWNED_DAYS = 60; // give new items a grace period

/**
 * Decluttering insights: items never/rarely worn or untouched for months.
 */
export async function declutterInsights(req: Request, res: Response): Promise<void> {
  const now = Date.now();
  const staleBefore = new Date(now - STALE_MONTHS * 30 * 24 * 3600 * 1000);
  const ownedBefore = new Date(now - MIN_OWNED_DAYS * 24 * 3600 * 1000);

  const items = await prisma.clothingItem.findMany({
    where: {
      userId: req.user!.id,
      isArchived: false,
      createdAt: { lt: ownedBefore },
      OR: [
        { lastWornDate: { lt: staleBefore } },
        { lastWornDate: null },
        { wearCount: { lte: LOW_WEAR_THRESHOLD } },
      ],
    },
    orderBy: [{ lastWornDate: { sort: 'asc', nulls: 'first' } }, { wearCount: 'asc' }],
    take: 50,
  });

  const result: DeclutterItemDto[] = items.map((item) => {
    let reason: string;
    if (!item.lastWornDate) {
      reason = 'Never worn since you added it';
    } else if (item.lastWornDate < staleBefore) {
      const months = Math.floor((now - item.lastWornDate.getTime()) / (30 * 24 * 3600 * 1000));
      reason = `Not worn in ${months} months`;
    } else {
      reason = `Worn only ${item.wearCount} time${item.wearCount === 1 ? '' : 's'}`;
    }
    return { item: toItemDto(item), reason };
  });

  res.json(result);
}
