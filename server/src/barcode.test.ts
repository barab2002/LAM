import http from 'http';
import { AddressInfo } from 'net';
import request from 'supertest';
import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';

const app = createApp();
const asUser = { 'x-dev-user': 'scanner@example.com' };

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const KNOWN_CODE = '4002515289693';
const IMAGELESS_CODE = '4002515289694';

/** Mock of the UPCitemdb trial API + a product-image host. */
function startMockUpstream(): Promise<{ server: http.Server; url: string }> {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url!, 'http://x');
    if (url.pathname === '/lookup') {
      const code = url.searchParams.get('upc');
      if (code === KNOWN_CODE) {
        const port = (server.address() as AddressInfo).port;
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            code: 'OK',
            items: [
              {
                title: 'Classic Denim Jacket',
                brand: 'Acme Wear',
                images: [`http://127.0.0.1:${port}/product.jpg`],
              },
            ],
          }),
        );
      } else if (code === IMAGELESS_CODE) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ code: 'OK', items: [{ title: 'Mystery Socks', images: [] }] }));
      } else {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ code: 'NOT_FOUND', items: [] }));
      }
      return;
    }
    if (url.pathname === '/product.jpg') {
      res.writeHead(200, { 'content-type': 'image/png' });
      res.end(PNG_1PX);
      return;
    }
    res.writeHead(404);
    res.end();
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}` });
    });
  });
}

let mock: { server: http.Server; url: string };
let savedApiUrl: string;

beforeAll(async () => {
  mock = await startMockUpstream();
  savedApiUrl = env.barcodeApiUrl;
  (env as { barcodeApiUrl: string }).barcodeApiUrl = mock.url;
});

afterAll(async () => {
  (env as { barcodeApiUrl: string }).barcodeApiUrl = savedApiUrl;
  mock.server.close();
  await prisma.$disconnect();
});

describe('Barcode add', () => {
  it('rejects malformed codes', async () => {
    const res = await request(app).get('/api/v1/barcode/not-a-code').set(asUser);
    expect(res.status).toBe(400);
  });

  it('looks up product metadata', async () => {
    const res = await request(app).get(`/api/v1/barcode/${KNOWN_CODE}`).set(asUser);
    expect(res.status).toBe(200);
    expect(res.body.found).toBe(true);
    expect(res.body.title).toBe('Classic Denim Jacket');
    expect(res.body.brand).toBe('Acme Wear');
    expect(res.body.existingItemId).toBeNull();
  });

  it('reports not-found codes gracefully', async () => {
    const res = await request(app).get('/api/v1/barcode/99999999').set(asUser);
    expect(res.status).toBe(200);
    expect(res.body.found).toBe(false);
  });

  it('auto-adds an item from a barcode (image → AI pipeline → closet)', async () => {
    const res = await request(app)
      .post('/api/v1/items/from-barcode')
      .set(asUser)
      .send({ barcode: KNOWN_CODE });
    expect(res.status).toBe(201);
    expect(res.body.item.name).toBe('Classic Denim Jacket');
    expect(res.body.item.brand).toBe('Acme Wear');
    expect(res.body.item.barcode).toBe(KNOWN_CODE);
    expect(res.body.item.originalImageUrl).toContain('/uploads/');
  });

  it('surfaces the existing item on a duplicate scan', async () => {
    const res = await request(app).get(`/api/v1/barcode/${KNOWN_CODE}`).set(asUser);
    expect(res.body.existingItemId).toBeTruthy();
  });

  it('404s for imageless products so the app can fall back to a photo', async () => {
    const res = await request(app)
      .post('/api/v1/items/from-barcode')
      .set(asUser)
      .send({ barcode: IMAGELESS_CODE });
    expect(res.status).toBe(404);
    expect(res.body.error).toContain('photo');
  });

  it('persists a barcode passed with a manual photo upload', async () => {
    const res = await request(app)
      .post('/api/v1/items/upload')
      .set(asUser)
      .field('barcode', IMAGELESS_CODE)
      .field('name', 'Mystery Socks')
      .field('brand', 'Acme Wear')
      .attach('image', PNG_1PX, { filename: 'socks.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    expect(res.body.item.barcode).toBe(IMAGELESS_CODE);
    expect(res.body.item.name).toBe('Mystery Socks');
  });

  it('502s when the lookup service is down', async () => {
    (env as { barcodeApiUrl: string }).barcodeApiUrl = 'http://127.0.0.1:59997';
    const res = await request(app).get(`/api/v1/barcode/${KNOWN_CODE}`).set(asUser);
    expect(res.status).toBe(502);
    (env as { barcodeApiUrl: string }).barcodeApiUrl = mock.url;
  });
});
