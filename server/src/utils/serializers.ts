import { ClothingItem, Look, User, WearHistory } from '@prisma/client';
import type {
  ClothingItemDto,
  LookDto,
  UserProfileDto,
  WearHistoryDto,
  WeatherSnapshot,
} from '../types/api';

type LookWithItems = Look & { items: { item: ClothingItem }[] };

export function toItemDto(item: ClothingItem): ClothingItemDto {
  return {
    id: item.id,
    name: item.name,
    originalImageUrl: item.originalImageUrl,
    processedImageUrl: item.processedImageUrl,
    category: item.category,
    subcategory: item.subcategory,
    colors: item.colors,
    primaryColor: item.primaryColor,
    pattern: item.pattern,
    seasons: item.seasons,
    brand: item.brand,
    aiConfidence: item.aiConfidence,
    wearCount: item.wearCount,
    lastWornDate: item.lastWornDate?.toISOString() ?? null,
    isFavorite: item.isFavorite,
    isArchived: item.isArchived,
    createdAt: item.createdAt.toISOString(),
  };
}

export function toLookDto(look: LookWithItems): LookDto {
  return {
    id: look.id,
    name: look.name,
    source: look.source,
    score: look.score,
    items: look.items.map((li) => toItemDto(li.item)),
    createdAt: look.createdAt.toISOString(),
  };
}

export function toWearHistoryDto(
  entry: WearHistory & { look: LookWithItems | null },
): WearHistoryDto {
  return {
    id: entry.id,
    lookId: entry.lookId,
    look: entry.look ? toLookDto(entry.look) : null,
    wornDate: entry.wornDate.toISOString().slice(0, 10),
    eventType: entry.eventType,
    weather: (entry.weather as WeatherSnapshot | null) ?? null,
    notes: entry.notes,
  };
}

export function toProfileDto(user: User): UserProfileDto {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    photoUrl: user.photoUrl,
    bodyShape: user.bodyShape,
    heightCm: user.heightCm,
    weightKg: user.weightKg,
    gender: user.gender,
    locationLat: user.locationLat,
    locationLon: user.locationLon,
    locationName: user.locationName,
    stylePrefs: (user.stylePrefs as Record<string, unknown> | null) ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}
