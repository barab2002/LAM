import request from 'supertest';
import { createApp } from './app';
import { prisma } from './lib/prisma';

const app = createApp();
const asUser = { 'x-dev-user': 'pairer@example.com' };

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

async function addItem(tags: Record<string, unknown>): Promise<string> {
  const upload = await request(app)
    .post('/api/v1/items/upload')
    .set(asUser)
    .attach('image', PNG_1PX, { filename: 'x.png', contentType: 'image/png' });
  const patched = await request(app)
    .patch(`/api/v1/items/${upload.body.item.id}`)
    .set(asUser)
    .send(tags);
  return patched.body.id;
}

let topId: string;
let bottomAId: string;
let bottomBId: string;
let shoesId: string;
let bagId: string;

beforeAll(async () => {
  topId = await addItem({ category: 'TOP', primaryColor: 'white', colors: ['white'], name: 'White tee' });
  bottomAId = await addItem({ category: 'BOTTOM', primaryColor: 'navy', colors: ['navy'], name: 'Navy jeans' });
  bottomBId = await addItem({ category: 'BOTTOM', primaryColor: 'green', colors: ['green'], name: 'Green chinos' });
  shoesId = await addItem({ category: 'SHOES', primaryColor: 'black', colors: ['black'], name: 'Black sneakers' });
  bagId = await addItem({ category: 'BAG', primaryColor: 'brown', colors: ['brown'], name: 'Brown tote' });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Best to go with (item pairings)', () => {
  it('anchors every combination on the requested garment', async () => {
    const res = await request(app).get(`/api/v1/items/${topId}/pairings`).set(asUser);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    for (const pairing of res.body) {
      const ids = pairing.items.map((i: { id: string }) => i.id);
      expect(ids).toContain(topId);
      expect(pairing.score).toBeGreaterThan(0);
    }
  });

  it('offers both partner bottoms across the ranked list', async () => {
    const res = await request(app).get(`/api/v1/items/${topId}/pairings`).set(asUser);
    const allPartnerIds = new Set(
      res.body.flatMap((p: { items: { id: string }[] }) => p.items.map((i) => i.id)),
    );
    expect(allPartnerIds.has(bottomAId)).toBe(true);
    expect(allPartnerIds.has(bottomBId)).toBe(true);
  });

  it('appends accessory/bag anchors to regular outfits', async () => {
    const res = await request(app).get(`/api/v1/items/${bagId}/pairings`).set(asUser);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    for (const pairing of res.body) {
      const ids = pairing.items.map((i: { id: string }) => i.id);
      expect(ids).toContain(bagId);
      // Rides on a real outfit, not alone
      expect(ids.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('works when anchoring on shoes', async () => {
    const res = await request(app).get(`/api/v1/items/${shoesId}/pairings`).set(asUser);
    expect(res.status).toBe(200);
    for (const pairing of res.body) {
      expect(pairing.items.map((i: { id: string }) => i.id)).toContain(shoesId);
    }
  });

  it('404s for foreign items', async () => {
    const res = await request(app)
      .get(`/api/v1/items/${topId}/pairings`)
      .set({ 'x-dev-user': 'other@example.com' });
    expect(res.status).toBe(404);
  });

  it('filters looks by contained item', async () => {
    const look = await request(app)
      .post('/api/v1/looks')
      .set(asUser)
      .send({ name: 'Errands', itemIds: [topId, bottomAId] });
    expect(look.status).toBe(201);

    const withTop = await request(app).get(`/api/v1/looks?itemId=${topId}`).set(asUser);
    expect(withTop.body).toHaveLength(1);
    expect(withTop.body[0].id).toBe(look.body.id);

    const withOtherBottom = await request(app)
      .get(`/api/v1/looks?itemId=${bottomBId}`)
      .set(asUser);
    expect(withOtherBottom.body).toHaveLength(0);
  });
});
