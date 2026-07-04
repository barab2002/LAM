import request from 'supertest';
import { createApp } from './app';
import { prisma } from './lib/prisma';

const app = createApp();
const asUser = { 'x-dev-user': 'tester@example.com' };

// 1x1 transparent PNG
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

afterAll(async () => {
  await prisma.$disconnect();
});

describe('LAM API', () => {
  it('GET /health responds ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/v1/items');
    expect(res.status).toBe(401);
  });

  describe('full user flow', () => {
    const itemIds: string[] = [];
    let lookId: string;

    it('uploads garments (AI unavailable → untagged fallback)', async () => {
      for (let i = 0; i < 2; i++) {
        const res = await request(app)
          .post('/api/v1/items/upload')
          .set(asUser)
          .attach('image', PNG_1PX, { filename: 'shirt.png', contentType: 'image/png' });
        expect(res.status).toBe(201);
        expect(res.body.aiTagged).toBe(false);
        expect(res.body.item.originalImageUrl).toContain('/uploads/');
        itemIds.push(res.body.item.id);
      }
    });

    it('edits item tags manually', async () => {
      const top = await request(app)
        .patch(`/api/v1/items/${itemIds[0]}`)
        .set(asUser)
        .send({ category: 'TOP', primaryColor: 'White', colors: ['white'], seasons: ['SUMMER'] });
      expect(top.status).toBe(200);
      expect(top.body.primaryColor).toBe('white');

      const bottom = await request(app)
        .patch(`/api/v1/items/${itemIds[1]}`)
        .set(asUser)
        .send({ category: 'BOTTOM', primaryColor: 'blue', colors: ['blue'], seasons: ['SUMMER'] });
      expect(bottom.status).toBe(200);
    });

    it('lists and filters the closet', async () => {
      const all = await request(app).get('/api/v1/items').set(asUser);
      expect(all.body).toHaveLength(2);

      const tops = await request(app).get('/api/v1/items?category=TOP').set(asUser);
      expect(tops.body).toHaveLength(1);
      expect(tops.body[0].id).toBe(itemIds[0]);
    });

    it('creates a look from closet items', async () => {
      const res = await request(app)
        .post('/api/v1/looks')
        .set(asUser)
        .send({ name: 'Summer casual', itemIds });
      expect(res.status).toBe(201);
      expect(res.body.items).toHaveLength(2);
      lookId = res.body.id;
    });

    it('rejects looks with foreign items', async () => {
      const res = await request(app)
        .post('/api/v1/looks')
        .set(asUser)
        .send({ itemIds: ['nonexistent'] });
      expect(res.status).toBe(400);
    });

    it('logs a wear and bumps wearCount + lastWornDate', async () => {
      const res = await request(app)
        .post('/api/v1/wear-history')
        .set(asUser)
        .send({ lookId, wornDate: '2026-07-01', eventType: 'work' });
      expect(res.status).toBe(201);

      const item = await request(app).get(`/api/v1/items/${itemIds[0]}`).set(asUser);
      expect(item.body.wearCount).toBe(1);
      expect(item.body.lastWornDate).toContain('2026-07-01');

      const dup = await request(app)
        .post('/api/v1/wear-history')
        .set(asUser)
        .send({ lookId, wornDate: '2026-07-01' });
      expect(dup.status).toBe(409);
    });

    it('returns the calendar month feed', async () => {
      const res = await request(app).get('/api/v1/wear-history?month=2026-07').set(asUser);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].wornDate).toBe('2026-07-01');
      expect(res.body[0].look.id).toBe(lookId);
    });

    it('suggests outfits and excludes the recently worn look', async () => {
      const res = await request(app).get('/api/v1/suggestions/daily').set(asUser);
      expect(res.status).toBe(200);
      expect(res.body.weather.tempC).toBeDefined();
      // Only one top+bottom combo exists and it was worn 3 days ago → excluded
      expect(res.body.suggestions).toHaveLength(0);
    });

    it('records swipe feedback and learns color preferences', async () => {
      const res = await request(app)
        .post('/api/v1/feedback')
        .set(asUser)
        .send({ itemIds, liked: true });
      expect(res.status).toBe(201);
      expect(res.body.look.source).toBe('AI_SUGGESTED');

      const user = await prisma.user.findUniqueOrThrow({
        where: { firebaseUid: 'dev:tester@example.com' },
      });
      const pref = await prisma.colorPreference.findUnique({
        where: { userId_colorA_colorB: { userId: user.id, colorA: 'blue', colorB: 'white' } },
      });
      expect(pref).not.toBeNull();
      expect(pref!.weight).toBeCloseTo(0.2);

      // A dislike moves the weight back down
      await request(app).post('/api/v1/feedback').set(asUser).send({ itemIds, liked: false });
      const updated = await prisma.colorPreference.findUniqueOrThrow({
        where: { userId_colorA_colorB: { userId: user.id, colorA: 'blue', colorB: 'white' } },
      });
      expect(updated.weight).toBeCloseTo(0);
      expect(updated.samples).toBe(2);
    });

    it('updates the profile (body shape + location)', async () => {
      const res = await request(app)
        .patch('/api/v1/profile')
        .set(asUser)
        .send({ bodyShape: 'PEAR', heightCm: 170, locationLat: 32.08, locationLon: 34.78 });
      expect(res.status).toBe(200);
      expect(res.body.bodyShape).toBe('PEAR');
    });

    it('isolates users from each other', async () => {
      const stranger = { 'x-dev-user': 'other@example.com' };
      const res = await request(app).get('/api/v1/items').set(stranger);
      expect(res.body).toHaveLength(0);

      const foreign = await request(app).get(`/api/v1/items/${itemIds[0]}`).set(stranger);
      expect(foreign.status).toBe(404);
    });

    it('serves declutter insights', async () => {
      const res = await request(app).get('/api/v1/insights/declutter').set(asUser);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
