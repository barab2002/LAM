import http from 'http';
import { AddressInfo } from 'net';
import request from 'supertest';
import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';

const app = createApp();
const asUser = { 'x-dev-user': 'jury@example.com' };

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/**
 * Tiny OpenAI-compatible /chat/completions mock. Answers persona prompts
 * with valid JSON; scores derived from the request so rounds are traceable.
 */
function startMockLlm(): Promise<{ server: http.Server; url: string; calls: string[] }> {
  const calls: string[] = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const parsed = JSON.parse(body);
      const systemPrompt: string = parsed.messages[0].content;
      calls.push(systemPrompt);

      let content: string;
      if (systemPrompt.includes('report agent')) {
        content = 'The panel broadly approves; only the editor wants a bolder shoe.';
      } else if (systemPrompt.includes('Now you hear the rest of the panel')) {
        // Round 2: nudge up and reply — tests the opinion-dynamics pass
        content = JSON.stringify({ score: 88, reply: 'Fair points all around.' });
      } else {
        // Round 1: distinct score per persona name for traceability
        const editor = systemPrompt.includes('Margaux');
        content = JSON.stringify({
          score: editor ? 60 : 80,
          comment: editor ? 'Competent, if unadventurous.' : 'Honestly? It works.',
        });
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content } }] }));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, url: `http://127.0.0.1:${port}`, calls });
    });
  });
}

async function uploadTwoItems(): Promise<string[]> {
  const ids: string[] = [];
  for (const tags of [
    { category: 'TOP', primaryColor: 'red', colors: ['red'], name: 'Red tee' },
    { category: 'BOTTOM', primaryColor: 'navy', colors: ['navy'], name: 'Navy trousers' },
  ]) {
    const upload = await request(app)
      .post('/api/v1/items/upload')
      .set(asUser)
      .attach('image', PNG_1PX, { filename: 'x.png', contentType: 'image/png' });
    const patched = await request(app)
      .patch(`/api/v1/items/${upload.body.item.id}`)
      .set(asUser)
      .send(tags);
    ids.push(patched.body.id);
  }
  return ids;
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Style Jury API', () => {
  let itemIds: string[];

  beforeAll(async () => {
    itemIds = await uploadTwoItems();
  });

  it('rates an ad-hoc combo with the heuristic jury when no LLM is configured', async () => {
    const res = await request(app).post('/api/v1/ratings').set(asUser).send({ itemIds });
    expect(res.status).toBe(201);
    expect(res.body.source).toBe('HEURISTIC');
    expect(res.body.personas).toHaveLength(7);
    expect(res.body.overallScore).toBeGreaterThan(0);
    expect(res.body.verdict.length).toBeGreaterThan(10);
    // Multi-item combos are anchored to a persisted look
    expect(res.body.lookId).toBeTruthy();
  });

  it('rates a single captured item without creating a look', async () => {
    const res = await request(app)
      .post('/api/v1/ratings')
      .set(asUser)
      .send({ itemId: itemIds[0], occasion: 'party' });
    expect(res.status).toBe(201);
    expect(res.body.lookId).toBeNull();
  });

  it('rejects rating with no subject or foreign items', async () => {
    expect((await request(app).post('/api/v1/ratings').set(asUser).send({})).status).toBe(400);
    expect(
      (
        await request(app)
          .post('/api/v1/ratings')
          .set(asUser)
          .send({ itemIds: ['nonexistent'] })
      ).status,
    ).toBe(400);
  });

  it('lists and fetches ratings, scoped per user', async () => {
    const list = await request(app).get('/api/v1/ratings').set(asUser);
    expect(list.status).toBe(200);
    expect(list.body.length).toBeGreaterThanOrEqual(2);

    const one = await request(app).get(`/api/v1/ratings/${list.body[0].id}`).set(asUser);
    expect(one.status).toBe(200);

    const stranger = await request(app)
      .get(`/api/v1/ratings/${list.body[0].id}`)
      .set({ 'x-dev-user': 'nosy@example.com' });
    expect(stranger.status).toBe(404);
  });

  it('runs the full two-round LLM simulation against a mock backend', async () => {
    const mock = await startMockLlm();
    const saved = { ...env.llm };
    Object.assign(env.llm, { baseUrl: mock.url, model: 'mock-model', apiKey: 'test' });

    try {
      const res = await request(app).post('/api/v1/ratings').set(asUser).send({ itemIds });
      expect(res.status).toBe(201);
      expect(res.body.source).toBe('LLM');
      expect(res.body.personas).toHaveLength(7);
      // Round 2 revised everyone to 88, bounded by ±10 from round 1
      // (Margaux 60→70 capped, others 80→88)
      const margaux = res.body.personas.find((p: { name: string }) => p.name === 'Margaux');
      expect(margaux.score).toBe(70);
      expect(margaux.reply).toBe('Fair points all around.');
      expect(res.body.overallScore).toBe(Math.round((70 + 88 * 6) / 7));
      expect(res.body.verdict).toContain('panel broadly approves');
      // 7 round-1 + 7 round-2 + 1 report = 15 calls
      expect(mock.calls).toHaveLength(15);
    } finally {
      Object.assign(env.llm, saved);
      mock.server.close();
    }
  });

  it('falls back to the heuristic jury when the LLM endpoint is down', async () => {
    const saved = { ...env.llm };
    Object.assign(env.llm, { baseUrl: 'http://127.0.0.1:59998', model: 'mock', apiKey: 'x' });
    try {
      const res = await request(app).post('/api/v1/ratings').set(asUser).send({ itemIds });
      expect(res.status).toBe(201);
      expect(res.body.source).toBe('HEURISTIC');
      expect(res.body.personas).toHaveLength(7);
    } finally {
      Object.assign(env.llm, saved);
    }
  });
});
