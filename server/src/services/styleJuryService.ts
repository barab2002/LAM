/**
 * Style Jury — a MiroFish/POSIM-inspired persona-panel simulation that
 * predicts how people would react to an outfit.
 *
 * Pipeline (LLM mode):
 *   round 1: each persona reacts independently → {score, comment}
 *   round 2: personas read each other's takes and may revise (±10) and
 *            reply — a one-step opinion-dynamics pass (conformity/pile-on)
 *   report:  a summarizer condenses the panel into a two-sentence verdict
 *
 * Heuristic mode (no LLM configured / LLM failed): deterministic scores from
 * the existing outfit-scoring engine + per-persona offsets and template
 * comments, so the feature always works.
 */
import { env } from '../config/env';
import type { PersonaReactionDto, WeatherSnapshot } from '../types/api';
import { ChatMessage, chatCompletion, extractJson, llmConfigured } from './llmClient';
import {
  BodyShape,
  ScorableItem,
  scoreBodyShapeFit,
  scoreColorHarmony,
  scoreFreshness,
} from './outfitScoring';

export interface JuryItem extends ScorableItem {
  name: string | null;
  subcategory: string | null;
  pattern: string | null;
  imageUrl: string | null;
}

export interface JuryContext {
  weather?: WeatherSnapshot | null;
  occasion?: string;
  bodyShape?: BodyShape | null;
}

export interface JuryResult {
  overallScore: number;
  verdict: string;
  personas: PersonaReactionDto[];
  source: 'LLM' | 'HEURISTIC';
}

interface Persona {
  name: string;
  emoji: string;
  role: string;
  voice: string; // system-prompt personality
  /** Deterministic bias used by the heuristic jury */
  offset: number;
}

export const PERSONAS: Persona[] = [
  {
    name: 'Margaux',
    emoji: '🕶️',
    role: 'Fashion editor',
    voice:
      'You are Margaux, a sharp fashion magazine editor. Exacting, a little jaded, allergic to mediocrity, but you give credit where due. You judge silhouette, color story and intent.',
    offset: -8,
  },
  {
    name: 'Riley',
    emoji: '🎉',
    role: 'Best friend',
    voice:
      'You are Riley, the user\'s hype-person best friend. Warm, enthusiastic, honest only in the kindest way. You want them to feel great but you\'ll gently flag anything truly off.',
    offset: +10,
  },
  {
    name: 'Dana',
    emoji: '💼',
    role: 'Coworker',
    voice:
      'You are Dana, a colleague at a business-casual office. You judge whether the outfit reads professional, appropriate and put-together for a workplace.',
    offset: -3,
  },
  {
    name: 'Alex',
    emoji: '🌹',
    role: 'First date',
    voice:
      'You are Alex, about to meet this person on a first date. You notice effort, fit and whether the look feels confident and intentional.',
    offset: +2,
  },
  {
    name: 'Zed',
    emoji: '🛹',
    role: 'Gen-Z streetwear kid',
    voice:
      'You are Zed, 19, terminally online, deep in streetwear culture. You rate drip, proportions and whether the fit goes hard or is mid. Use casual slang sparingly.',
    offset: -5,
  },
  {
    name: 'Nana Ruth',
    emoji: '🧶',
    role: 'Pragmatic grandma',
    voice:
      'You are Ruth, a loving, practical grandmother. You care whether they\'ll be warm enough, comfortable, and looking respectable. Fashion trends confuse you a little.',
    offset: +6,
  },
  {
    name: 'Kenji',
    emoji: '🎋',
    role: 'Minimalist stylist',
    voice:
      'You are Kenji, a minimalist personal stylist. You prize restraint, cohesive palettes and clean lines; visual noise and clashing colors physically hurt you.',
    offset: -2,
  },
];

// ---------- shared helpers (pure, unit-tested) ----------

export function clampScore(n: unknown, fallback = 60): number {
  const num = Number(n);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(100, Math.max(0, Math.round(num)));
}

export function aggregateScores(personas: PersonaReactionDto[]): number {
  if (personas.length === 0) return 50;
  return clampScore(personas.reduce((sum, p) => sum + p.score, 0) / personas.length);
}

export function buildOutfitDescription(items: JuryItem[], ctx: JuryContext): string {
  const lines = items.map((item, i) => {
    const bits = [
      item.name ?? item.subcategory ?? item.category.toLowerCase(),
      `category: ${item.category.toLowerCase()}`,
      item.primaryColor ? `color: ${item.primaryColor}` : null,
      item.colors.length > 1 ? `palette: ${item.colors.join(', ')}` : null,
      item.pattern ? `pattern: ${item.pattern}` : null,
    ].filter(Boolean);
    return `${i + 1}. ${bits.join(' · ')}`;
  });

  const context: string[] = [];
  if (ctx.weather) {
    context.push(`Weather: ${Math.round(ctx.weather.tempC)}°C, ${ctx.weather.condition}`);
  }
  if (ctx.occasion) context.push(`Occasion: ${ctx.occasion}`);

  return [`The outfit:`, ...lines, ...(context.length ? ['', ...context] : [])].join('\n');
}

// ---------- LLM jury ----------

const REACTION_FORMAT =
  'Respond with ONLY a JSON object: {"score": <integer 0-100>, "comment": "<one or two sentences, in character>"}';

function userContent(description: string, items: JuryItem[]): ChatMessage['content'] {
  if (!env.llm.vision) return description;
  const images = items
    .map((i) => i.imageUrl)
    .filter((u): u is string => Boolean(u))
    .slice(0, 4)
    .map((url) => ({ type: 'image_url' as const, image_url: { url } }));
  if (images.length === 0) return description;
  return [{ type: 'text' as const, text: description }, ...images];
}

async function llmRound1(
  persona: Persona,
  description: string,
  items: JuryItem[],
): Promise<{ score: number; comment: string }> {
  const completion = await chatCompletion(
    [
      {
        role: 'system',
        content: `${persona.voice}\nYou are on a style jury rating someone's outfit. ${REACTION_FORMAT}`,
      },
      { role: 'user', content: userContent(description, items) },
    ],
    { temperature: 0.9, maxTokens: 200 },
  );
  const parsed = extractJson<{ score: unknown; comment: unknown }>(completion);
  return {
    score: clampScore(parsed.score),
    comment: String(parsed.comment ?? '').slice(0, 300) || '(nods silently)',
  };
}

async function llmRound2(
  persona: Persona,
  own: { score: number; comment: string },
  others: PersonaReactionDto[],
): Promise<{ score: number; reply?: string }> {
  const discussion = others
    .filter((o) => o.name !== persona.name)
    .map((o) => `${o.name} (${o.role}, ${o.score}/100): "${o.comment}"`)
    .join('\n');

  const completion = await chatCompletion(
    [
      {
        role: 'system',
        content: `${persona.voice}\nYou rated an outfit ${own.score}/100 saying: "${own.comment}". Now you hear the rest of the panel. You may adjust your score by at most 10 points if they changed your mind, and optionally add ONE short reply to the discussion. Respond with ONLY JSON: {"score": <integer>, "reply": "<one sentence or empty string>"}`,
      },
      { role: 'user', content: `The panel discussion:\n${discussion}` },
    ],
    { temperature: 0.7, maxTokens: 150 },
  );
  const parsed = extractJson<{ score: unknown; reply?: unknown }>(completion);
  // Enforce the ±10 opinion-dynamics bound even if the model ignores it
  const revised = clampScore(parsed.score, own.score);
  const bounded = Math.min(own.score + 10, Math.max(own.score - 10, revised));
  const reply = String(parsed.reply ?? '').trim().slice(0, 200);
  return { score: bounded, reply: reply || undefined };
}

async function llmVerdict(personas: PersonaReactionDto[], overall: number): Promise<string> {
  const summary = personas
    .map((p) => `${p.name} (${p.role}): ${p.score}/100 — "${p.comment}"`)
    .join('\n');
  const completion = await chatCompletion(
    [
      {
        role: 'system',
        content:
          'You are the report agent of a style jury. Summarize the panel\'s reaction to the outfit in at most two sentences: the consensus, and the main split if there is one. Plain text only, no JSON.',
      },
      { role: 'user', content: `Overall ${overall}/100.\n${summary}` },
    ],
    { temperature: 0.5, maxTokens: 120 },
  );
  return completion.trim().slice(0, 400);
}

async function llmJury(items: JuryItem[], ctx: JuryContext): Promise<JuryResult> {
  const description = buildOutfitDescription(items, ctx);

  // Round 1 — independent takes (parallel). A persona whose call/parse fails
  // falls back to its deterministic heuristic reaction so the panel stays
  // full — but if the whole panel failed, the backend is down: bail out so
  // the caller uses the (properly labeled) heuristic jury instead.
  const heuristic = heuristicJury(items, ctx);
  let failures = 0;
  const round1 = await Promise.all(
    PERSONAS.map(async (persona, i) => {
      try {
        const r = await llmRound1(persona, description, items);
        return { ...personaShell(persona), ...r };
      } catch (err) {
        console.warn(`[jury] ${persona.name} round-1 failed:`, (err as Error).message);
        failures++;
        return heuristic.personas[i];
      }
    }),
  );
  if (failures === PERSONAS.length) {
    throw new Error('LLM backend unreachable — every persona call failed');
  }

  // Round 2 — opinion dynamics (parallel, best-effort)
  const finals = await Promise.all(
    round1.map(async (reaction, i) => {
      try {
        const revised = await llmRound2(PERSONAS[i], reaction, round1);
        return { ...reaction, score: revised.score, reply: revised.reply };
      } catch {
        return reaction;
      }
    }),
  );

  const overallScore = aggregateScores(finals);
  let verdict: string;
  try {
    verdict = await llmVerdict(finals, overallScore);
  } catch {
    verdict = templateVerdict(overallScore);
  }

  return { overallScore, verdict, personas: finals, source: 'LLM' };
}

// ---------- heuristic jury (deterministic, no network) ----------

function personaShell(persona: Persona): Omit<PersonaReactionDto, 'score' | 'comment'> {
  return { name: persona.name, emoji: persona.emoji, role: persona.role };
}

export function templateVerdict(score: number): string {
  if (score >= 80) return 'The panel is impressed — this outfit lands almost across the board.';
  if (score >= 65) return 'A solid look overall; the panel likes it with a few reservations.';
  if (score >= 50) return 'Mixed reviews — some panelists are on board, others want tweaks.';
  return 'The jury is skeptical — this combination splits or underwhelms the room.';
}

/** Small deterministic hash so template comments vary per outfit but stay stable. */
function pick<T>(pool: T[], seedString: string, salt: number): T {
  let hash = salt;
  for (let i = 0; i < seedString.length; i++) {
    hash = (hash * 31 + seedString.charCodeAt(i)) | 0;
  }
  return pool[Math.abs(hash) % pool.length];
}

const COMMENT_POOLS: Record<string, (facts: OutfitFacts) => string[]> = {
  Margaux: (f) => [
    f.monochrome
      ? `A ${f.mainColor} monochrome — restrained, editorial, I almost approve.`
      : `The ${f.colorList} pairing is ${f.hasNeutral ? 'safe but coherent' : 'a gamble that needs conviction'}.`,
    `${f.pieceCount} pieces, ${f.hasOuterwear ? 'layered with intent' : 'no layering to speak of'} — the silhouette does ${f.hasDress ? 'have a line' : 'the job'}.`,
  ],
  Riley: (f) => [
    `Okay the ${f.mainColor} ${f.mainPiece} is SO you — wear it, you look amazing!`,
    `Love this combo, especially with the ${f.colorList} thing going on. Confidence up!`,
  ],
  Dana: (f) => [
    f.hasNeutral
      ? `Reads polished — the ${f.mainColor} keeps it office-appropriate.`
      : `Bold for the office, but if anyone can pull off ${f.colorList}, go for it.`,
    `Perfectly presentable${f.hasOuterwear ? ', and the layer elevates it' : ''}.`,
  ],
  Alex: (f) => [
    `Shows effort without trying too hard — the ${f.mainColor} ${f.mainPiece} works.`,
    `I'd notice this across the room, in a good way.`,
  ],
  Zed: (f) => [
    f.monochrome
      ? `Tonal ${f.mainColor} fit, lowkey clean.`
      : `The ${f.colorList} combo is ${f.hasNeutral ? 'safe but it works' : 'kinda loud, could go either way'}.`,
    `Proportions ${f.hasOuterwear ? 'hit with the layer' : 'are simple but fine'}, solid fit.`,
  ],
  'Nana Ruth': (f) =>
    f.warmEnough
      ? [
          `Very smart, dear — and you'll be comfortable too.`,
          `You look respectable and comfortable — that's what matters.`,
        ]
      : [
          `Lovely colors, but will you be warm enough in that?`,
          `Where's your coat, sweetheart? I don't think you'll be warm enough.`,
        ],
  Kenji: (f) => [
    f.monochrome
      ? `A single-tone palette — quiet, cohesive, correct.`
      : f.hasNeutral
        ? `The neutral anchors the ${f.colorList} palette. Acceptable cohesion.`
        : `${f.colorCount} saturated colors compete for attention; edit one out.`,
    `${f.pieceCount} pieces, nothing superfluous${f.hasNeutral ? '' : ' except perhaps a color'}.`,
  ],
};

interface OutfitFacts {
  mainColor: string;
  mainPiece: string;
  colorList: string;
  colorCount: number;
  monochrome: boolean;
  hasNeutral: boolean;
  hasOuterwear: boolean;
  hasDress: boolean;
  pieceCount: number;
  warmEnough: boolean;
}

const NEUTRALS = new Set(['black', 'white', 'gray', 'grey', 'beige', 'cream', 'tan', 'navy', 'brown', 'denim', 'khaki']);

function outfitFacts(items: JuryItem[], ctx: JuryContext): OutfitFacts {
  const colors = [
    ...new Set(
      items.map((i) => (i.primaryColor ?? i.colors[0] ?? '').toLowerCase()).filter(Boolean),
    ),
  ];
  const main = items[0];
  return {
    mainColor: colors[0] ?? 'neutral',
    mainPiece: (main?.name ?? main?.subcategory ?? main?.category ?? 'piece').toLowerCase(),
    colorList: colors.slice(0, 3).join(' + ') || 'muted',
    colorCount: colors.length,
    monochrome: colors.length === 1 && items.length > 1,
    hasNeutral: colors.some((c) => NEUTRALS.has(c)),
    hasOuterwear: items.some((i) => i.category === 'OUTERWEAR'),
    hasDress: items.some((i) => i.category === 'DRESS'),
    pieceCount: items.length,
    warmEnough:
      !ctx.weather || ctx.weather.tempC >= 15 || items.some((i) => i.category === 'OUTERWEAR'),
  };
}

/**
 * Deterministic jury: base score from the suggestion engine's pure scoring
 * functions, per-persona offsets, template comments derived from the outfit.
 */
export function heuristicJury(
  items: JuryItem[],
  ctx: JuryContext,
  learnedWeights: ReadonlyMap<string, number> = new Map(),
): JuryResult {
  const color = scoreColorHarmony(items, learnedWeights);
  const body = scoreBodyShapeFit(items, ctx.bodyShape ?? null);
  const fresh = scoreFreshness(items, new Date());

  // Engine score roughly spans [-0.3, 1.0] → map onto a 35..92 band
  const engine = color.score + body.score + fresh.score;
  const base = clampScore(62 + engine * 40);

  const facts = outfitFacts(items, ctx);
  const seed = items
    .map((i) => i.id)
    .sort()
    .join(',');

  const personas: PersonaReactionDto[] = PERSONAS.map((persona, idx) => ({
    ...personaShell(persona),
    score: clampScore(base + persona.offset + (facts.hasNeutral ? 2 : -2)),
    comment: pick(COMMENT_POOLS[persona.name](facts), seed, idx * 7 + 1),
  }));

  const overallScore = aggregateScores(personas);
  return { overallScore, verdict: templateVerdict(overallScore), personas, source: 'HEURISTIC' };
}

// ---------- entry point ----------

export async function runStyleJury(
  items: JuryItem[],
  ctx: JuryContext,
  learnedWeights: ReadonlyMap<string, number> = new Map(),
): Promise<JuryResult> {
  if (llmConfigured()) {
    try {
      return await llmJury(items, ctx);
    } catch (err) {
      console.warn('[jury] LLM jury failed, using heuristic panel:', (err as Error).message);
    }
  }
  return heuristicJury(items, ctx, learnedWeights);
}
