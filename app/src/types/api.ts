/**
 * Wire-format DTOs shared between server and clients.
 * Mirror of server/src/types/api.ts — keep in sync.
 */

export type BodyShape =
  | 'HOURGLASS'
  | 'PEAR'
  | 'APPLE'
  | 'RECTANGLE'
  | 'INVERTED_TRIANGLE';

export type Gender = 'FEMALE' | 'MALE' | 'NON_BINARY' | 'UNSPECIFIED';

export type ClothingCategory =
  | 'TOP'
  | 'BOTTOM'
  | 'DRESS'
  | 'OUTERWEAR'
  | 'SHOES'
  | 'ACCESSORY'
  | 'BAG';

export type Season = 'SPRING' | 'SUMMER' | 'FALL' | 'WINTER';

export type LookSource = 'AI_SUGGESTED' | 'USER_CREATED';

export interface UserProfileDto {
  id: string;
  email: string;
  displayName: string | null;
  photoUrl: string | null;
  bodyShape: BodyShape | null;
  heightCm: number | null;
  weightKg: number | null;
  gender: Gender;
  locationLat: number | null;
  locationLon: number | null;
  locationName: string | null;
  stylePrefs: Record<string, unknown> | null;
  createdAt: string;
}

export interface UpdateProfileRequest {
  displayName?: string;
  bodyShape?: BodyShape;
  heightCm?: number;
  weightKg?: number;
  gender?: Gender;
  locationLat?: number;
  locationLon?: number;
  locationName?: string;
  stylePrefs?: Record<string, unknown>;
}

export interface ClothingItemDto {
  id: string;
  name: string | null;
  originalImageUrl: string;
  processedImageUrl: string | null;
  category: ClothingCategory;
  subcategory: string | null;
  colors: string[];
  primaryColor: string | null;
  pattern: string | null;
  seasons: Season[];
  brand: string | null;
  aiConfidence: number | null;
  wearCount: number;
  lastWornDate: string | null;
  isFavorite: boolean;
  isArchived: boolean;
  createdAt: string;
}

export interface UpdateItemRequest {
  name?: string;
  category?: ClothingCategory;
  subcategory?: string;
  colors?: string[];
  primaryColor?: string;
  pattern?: string;
  seasons?: Season[];
  brand?: string;
  isFavorite?: boolean;
  isArchived?: boolean;
}

export interface LookDto {
  id: string;
  name: string | null;
  source: LookSource;
  score: number | null;
  items: ClothingItemDto[];
  createdAt: string;
}

export interface CreateLookRequest {
  name?: string;
  itemIds: string[];
  source?: LookSource;
}

export interface WeatherSnapshot {
  tempC: number;
  tempMinC?: number;
  tempMaxC?: number;
  precipitationMm?: number;
  windKmh?: number;
  condition: string; // "clear" | "cloudy" | "rain" | "snow" | ...
}

export interface WearHistoryDto {
  id: string;
  lookId: string | null;
  look: LookDto | null;
  wornDate: string; // YYYY-MM-DD
  eventType: string | null;
  weather: WeatherSnapshot | null;
  notes: string | null;
}

export interface LogWearRequest {
  lookId: string;
  wornDate: string; // YYYY-MM-DD
  eventType?: string;
  notes?: string;
}

export interface SuggestedLookDto {
  /** null until the user accepts/rates it — then it's persisted as a Look */
  lookId: string | null;
  items: ClothingItemDto[];
  score: number;
  reasons: string[]; // human-readable explanation chips
}

export interface DailySuggestionsResponse {
  weather: WeatherSnapshot;
  suggestions: SuggestedLookDto[];
}

export interface FeedbackRequest {
  /** Either an existing lookId or a raw item combination */
  lookId?: string;
  itemIds?: string[];
  liked: boolean;
}

export interface DeclutterItemDto {
  item: ClothingItemDto;
  reason: string; // e.g. "Not worn in 8 months"
}

// ---------- Style Jury (outfit rating + simulated public opinion) ----------

export type RatingSource = 'LLM' | 'HEURISTIC';

export interface PersonaReactionDto {
  name: string;
  emoji: string;
  role: string;
  score: number; // 0..100 (after the opinion-dynamics round)
  comment: string;
  /** One-line reply from the discussion round, if the persona spoke up */
  reply?: string;
}

export interface OutfitRatingDto {
  id: string;
  lookId: string | null;
  overallScore: number; // 0..100
  verdict: string;
  personas: PersonaReactionDto[];
  source: RatingSource;
  createdAt: string;
}

export interface CreateRatingRequest {
  /** Rate an existing look… */
  lookId?: string;
  /** …or an ad-hoc combination (persisted as an AI_SUGGESTED look) */
  itemIds?: string[];
  /** …or a single captured item/photo */
  itemId?: string;
  occasion?: string;
}

export interface ApiError {
  error: string;
  details?: unknown;
}
