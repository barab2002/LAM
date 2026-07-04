import dotenv from 'dotenv';

dotenv.config();

function bool(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1';
}

function int(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: int(process.env.PORT, 4000),
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? `http://localhost:${int(process.env.PORT, 4000)}`,
  databaseUrl: process.env.DATABASE_URL ?? '',

  devAuthBypass: bool(process.env.DEV_AUTH_BYPASS) && process.env.NODE_ENV !== 'production',

  firebase: {
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || undefined,
    serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON || undefined,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || undefined,
  },

  aiService: {
    url: process.env.AI_SERVICE_URL ?? 'http://localhost:8000',
    secret: process.env.AI_SERVICE_SECRET ?? '',
  },

  /**
   * Style Jury LLM backend — any OpenAI-compatible /chat/completions
   * endpoint (Ollama, Groq, OpenRouter free models, Gemini's compat
   * endpoint, OpenAI, ...). Leave baseUrl empty to use the deterministic
   * heuristic jury instead.
   */
  llm: {
    baseUrl: (process.env.LLM_BASE_URL ?? '').replace(/\/$/, ''),
    apiKey: process.env.LLM_API_KEY ?? '',
    model: process.env.LLM_MODEL ?? '',
    vision: bool(process.env.LLM_VISION),
    timeoutMs: int(process.env.LLM_TIMEOUT_MS, 45_000),
  },

  antiRepeatDays: int(process.env.ANTI_REPEAT_DAYS, 14),

  /** Barcode product lookup — UPCitemdb-compatible API (free trial default) */
  barcodeApiUrl: (process.env.BARCODE_API_URL ?? 'https://api.upcitemdb.com/prod/trial').replace(
    /\/$/,
    '',
  ),
};

export type Env = typeof env;
