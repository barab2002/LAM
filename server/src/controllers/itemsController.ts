import { Request, Response } from 'express';
import { ClothingItem, Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/error';
import { analyzeGarment } from '../services/aiClient';
import { fetchProductImage, isValidBarcode, lookupBarcode } from '../services/barcodeService';
import { storeImage } from '../services/storageService';
import { toItemDto } from '../utils/serializers';

const CATEGORIES = ['TOP', 'BOTTOM', 'DRESS', 'OUTERWEAR', 'SHOES', 'ACCESSORY', 'BAG'] as const;
const SEASONS = ['SPRING', 'SUMMER', 'FALL', 'WINTER'] as const;

const listQuerySchema = z.object({
  category: z.enum(CATEGORIES).optional(),
  color: z.string().optional(),
  season: z.enum(SEASONS).optional(),
  favorite: z.enum(['true', 'false']).optional(),
  archived: z.enum(['true', 'false']).optional(),
  search: z.string().optional(),
});

const updateItemSchema = z.object({
  name: z.string().max(120).optional(),
  category: z.enum(CATEGORIES).optional(),
  subcategory: z.string().max(60).nullable().optional(),
  colors: z.array(z.string().max(40)).max(8).optional(),
  primaryColor: z.string().max(40).nullable().optional(),
  pattern: z.string().max(40).nullable().optional(),
  seasons: z.array(z.enum(SEASONS)).optional(),
  brand: z.string().max(80).nullable().optional(),
  isFavorite: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

export async function listItems(req: Request, res: Response): Promise<void> {
  const query = listQuerySchema.parse(req.query);
  const where: Prisma.ClothingItemWhereInput = {
    userId: req.user!.id,
    isArchived: query.archived ? query.archived === 'true' : false,
  };
  if (query.category) where.category = query.category;
  if (query.season) where.seasons = { has: query.season };
  if (query.color) where.colors = { has: query.color.toLowerCase() };
  if (query.favorite) where.isFavorite = query.favorite === 'true';
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { subcategory: { contains: query.search, mode: 'insensitive' } },
      { brand: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const items = await prisma.clothingItem.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
  res.json(items.map(toItemDto));
}

export async function getItem(req: Request, res: Response): Promise<void> {
  const item = await prisma.clothingItem.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
  });
  if (!item) throw new HttpError(404, 'Item not found');
  res.json(toItemDto(item));
}

interface IngestExtras {
  name?: string;
  brand?: string;
  barcode?: string;
}

/**
 * The auto-wardrobe pipeline shared by camera/gallery uploads and barcode
 * imports: store original → AI analyze (rembg + YOLO + colors) → store the
 * cutout → create the auto-tagged ClothingItem.
 */
export async function createItemFromImage(
  userId: string,
  buffer: Buffer,
  mimeType: string,
  extras: IngestExtras = {},
): Promise<{ item: ClothingItem; aiTagged: boolean }> {
  const original = await storeImage(buffer, { userId, mimeType, prefix: 'original' });

  const { result, aiAvailable } = await analyzeGarment(buffer, mimeType);

  let processedUrl: string | null = null;
  if (result.processedImageBase64) {
    const processed = await storeImage(Buffer.from(result.processedImageBase64, 'base64'), {
      userId,
      mimeType: 'image/png',
      prefix: 'processed',
    });
    processedUrl = processed.url;
  }

  const item = await prisma.clothingItem.create({
    data: {
      userId,
      originalImageUrl: original.url,
      processedImageUrl: processedUrl,
      category: result.category,
      subcategory: result.subcategory,
      colors: result.colors,
      primaryColor: result.primaryColor,
      pattern: result.pattern,
      seasons: result.seasons,
      aiConfidence: result.confidence,
      name: extras.name,
      brand: extras.brand,
      barcode: extras.barcode,
    },
  });

  return { item, aiTagged: aiAvailable };
}

const uploadExtrasSchema = z.object({
  name: z.string().max(120).optional(),
  brand: z.string().max(80).optional(),
  barcode: z.string().max(14).optional(),
});

export async function uploadItem(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file) throw new HttpError(400, 'Missing image file (field name: "image")');
  if (!file.mimetype.startsWith('image/')) throw new HttpError(400, 'File must be an image');
  const extras = uploadExtrasSchema.parse(req.body ?? {});
  if (extras.barcode && !isValidBarcode(extras.barcode)) delete extras.barcode;

  const { item, aiTagged } = await createItemFromImage(
    req.user!.id,
    file.buffer,
    file.mimetype,
    extras,
  );
  res.status(201).json({ item: toItemDto(item), aiTagged });
}

/**
 * GET /barcode/:code — product metadata for a scanned tag. Reports an
 * existing closet item with the same barcode so the app can jump to it.
 */
export async function lookupBarcodeHandler(req: Request, res: Response): Promise<void> {
  const code = req.params.code;
  if (!isValidBarcode(code)) throw new HttpError(400, 'Barcode must be 8-14 digits');

  const existing = await prisma.clothingItem.findFirst({
    where: { userId: req.user!.id, barcode: code, isArchived: false },
    select: { id: true },
  });

  let product;
  try {
    product = await lookupBarcode(code);
  } catch (err) {
    throw new HttpError(502, `Barcode lookup unavailable: ${(err as Error).message}`);
  }

  res.json({ barcode: code, ...product, existingItemId: existing?.id ?? null });
}

const fromBarcodeSchema = z.object({ barcode: z.string() });

/**
 * POST /items/from-barcode — auto-add: look the product up, pull its image
 * through the AI pipeline, prefill name/brand. 404s when the product has no
 * usable image (the app then falls back to camera/gallery, keeping the code).
 */
export async function addItemFromBarcode(req: Request, res: Response): Promise<void> {
  const { barcode } = fromBarcodeSchema.parse(req.body);
  if (!isValidBarcode(barcode)) throw new HttpError(400, 'Barcode must be 8-14 digits');

  const product = await lookupBarcode(barcode).catch((err) => {
    throw new HttpError(502, `Barcode lookup unavailable: ${(err as Error).message}`);
  });
  if (!product.found) throw new HttpError(404, 'Product not found for this barcode');
  if (!product.imageUrl) throw new HttpError(404, 'No product image — add it with a photo instead');

  const image = await fetchProductImage(product.imageUrl);
  if (!image) throw new HttpError(404, 'No product image — add it with a photo instead');

  const { item, aiTagged } = await createItemFromImage(req.user!.id, image.buffer, image.mimeType, {
    name: product.title ?? undefined,
    brand: product.brand ?? undefined,
    barcode,
  });
  res.status(201).json({ item: toItemDto(item), aiTagged });
}

export async function updateItem(req: Request, res: Response): Promise<void> {
  const data = updateItemSchema.parse(req.body);
  const existing = await prisma.clothingItem.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
    select: { id: true },
  });
  if (!existing) throw new HttpError(404, 'Item not found');

  const item = await prisma.clothingItem.update({
    where: { id: existing.id },
    data: {
      ...data,
      colors: data.colors?.map((c) => c.toLowerCase()),
      primaryColor: data.primaryColor?.toLowerCase(),
    },
  });
  res.json(toItemDto(item));
}

export async function deleteItem(req: Request, res: Response): Promise<void> {
  const existing = await prisma.clothingItem.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
    select: { id: true },
  });
  if (!existing) throw new HttpError(404, 'Item not found');
  await prisma.clothingItem.delete({ where: { id: existing.id } });
  res.status(204).end();
}
