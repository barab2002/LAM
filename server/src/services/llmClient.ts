import { env } from '../config/env';

/**
 * Minimal OpenAI-compatible /chat/completions client (fetch, no SDK).
 * Works with Ollama, Groq, OpenRouter, Gemini's compat endpoint, OpenAI…
 */

export type ChatContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    >;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: ChatContent;
}

export function llmConfigured(): boolean {
  return Boolean(env.llm.baseUrl && env.llm.model);
}

export async function chatCompletion(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number } = {},
): Promise<string> {
  if (!llmConfigured()) throw new Error('LLM backend not configured');

  const res = await fetch(`${env.llm.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(env.llm.apiKey ? { authorization: `Bearer ${env.llm.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: env.llm.model,
      messages,
      temperature: opts.temperature ?? 0.8,
      max_tokens: opts.maxTokens ?? 400,
    }),
    signal: AbortSignal.timeout(env.llm.timeoutMs),
  });

  if (!res.ok) {
    throw new Error(`LLM responded ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM returned an empty completion');
  return content;
}

/**
 * Extracts the first JSON object from a completion (models often wrap JSON
 * in prose or code fences). Throws when nothing parseable is found.
 */
export function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  if (start === -1) throw new Error('No JSON object in completion');

  // Walk to the matching closing brace of the first object
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') inString = !inString;
    if (inString) continue;
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        return JSON.parse(candidate.slice(start, i + 1)) as T;
      }
    }
  }
  throw new Error('Unbalanced JSON in completion');
}
