import { env } from '../config/env';
import type { ClothingCategory, Season } from '../types/api';

export interface AiAnalysisResult {
  category: ClothingCategory;
  subcategory: string | null;
  colors: string[];
  primaryColor: string | null;
  pattern: string | null;
  seasons: Season[];
  confidence: number;
  /** Base64-encoded transparent PNG with the background removed */
  processedImageBase64: string | null;
}

const FALLBACK_RESULT: AiAnalysisResult = {
  category: 'TOP',
  subcategory: null,
  colors: [],
  primaryColor: null,
  pattern: null,
  seasons: ['SPRING', 'SUMMER', 'FALL', 'WINTER'],
  confidence: 0,
  processedImageBase64: null,
};

/**
 * Sends an image to the Python AI microservice for background removal,
 * YOLO classification and color extraction. Degrades gracefully: if the
 * service is unreachable the item is saved untagged for manual editing.
 */
export async function analyzeGarment(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<{ result: AiAnalysisResult; aiAvailable: boolean }> {
  try {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(imageBuffer)], { type: mimeType }), 'garment');

    const res = await fetch(`${env.aiService.url}/analyze`, {
      method: 'POST',
      headers: { 'x-ai-secret': env.aiService.secret },
      body: form,
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      throw new Error(`AI service responded ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as AiAnalysisResult;
    return { result: { ...FALLBACK_RESULT, ...data }, aiAvailable: true };
  } catch (err) {
    console.warn('[aiClient] analyze failed, saving item untagged:', (err as Error).message);
    return { result: FALLBACK_RESULT, aiAvailable: false };
  }
}
