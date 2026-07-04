import { env } from '../config/env';

/**
 * Product lookup by EAN/UPC via a UPCitemdb-compatible API.
 * https://www.upcitemdb.com/wp/docs/main/development/getting-started/
 */

export interface BarcodeProduct {
  found: boolean;
  title: string | null;
  brand: string | null;
  imageUrl: string | null;
}

interface UpcItemDbResponse {
  code: string;
  items?: {
    title?: string;
    brand?: string;
    images?: string[];
  }[];
}

export function isValidBarcode(code: string): boolean {
  return /^\d{8,14}$/.test(code);
}

export async function lookupBarcode(code: string): Promise<BarcodeProduct> {
  const res = await fetch(`${env.barcodeApiUrl}/lookup?upc=${encodeURIComponent(code)}`, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  // UPCitemdb answers 404 for unknown codes — treat as "not found", not error
  if (res.status === 404) return { found: false, title: null, brand: null, imageUrl: null };
  if (!res.ok) throw new Error(`Barcode API responded ${res.status}`);

  const data = (await res.json()) as UpcItemDbResponse;
  const item = data.items?.[0];
  if (!item) return { found: false, title: null, brand: null, imageUrl: null };

  return {
    found: true,
    title: item.title?.slice(0, 120) ?? null,
    brand: item.brand?.slice(0, 80) ?? null,
    imageUrl: item.images?.find((u) => u?.startsWith('http')) ?? null,
  };
}

/** Downloads a product image (bounded size/time) for the ingest pipeline. */
export async function fetchProductImage(
  url: string,
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const mimeType = res.headers.get('content-type')?.split(';')[0] ?? 'image/jpeg';
    if (!mimeType.startsWith('image/')) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0 || buffer.length > 15 * 1024 * 1024) return null;
    return { buffer, mimeType };
  } catch {
    return null;
  }
}
