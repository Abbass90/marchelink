import request from 'supertest';
import { jest } from '@jest/globals';
import type { Express } from 'express';
import bcrypt from 'bcrypt';
import { setupTestDb, teardownTestDb, cleanTables, getTestDb } from '../../auth/__tests__/setup.js';

process.env.JWT_ACCESS_SECRET = 'test_access_secret_min_32_chars_xxxxxxxxxxxxx';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_min_32_chars_xxxxxxxxxxxx';
process.env.JWT_ACCESS_TTL_SEC = '900';
process.env.JWT_REFRESH_TTL_SEC = '604800';
process.env.COOKIE_SECURE = 'false';
process.env.NODE_ENV = 'test';

/* ── Mock Cloudinary (ESM) ──────────────────────────────────────────────
 * Enregistré AVANT le import dynamique du controller afin que getCloudinary
 * soit substitué. On ne touche jamais le vrai SDK (pas de réseau en CI).      */

const FAKE_URL = 'https://res.cloudinary.com/demo/image/upload/v1/marchelink/products/fake.jpg';

// upload_stream(options, callback) renvoie un objet { end(buffer) }.
// On invoque le callback de succès puis on expose un .end() espionnable.
const mockUploadStream = jest.fn(
  (_opts: unknown, cb: (err: unknown, result: { secure_url: string } | undefined) => void) => {
    cb(null, { secure_url: FAKE_URL });
    return { end: jest.fn() };
  },
);

jest.unstable_mockModule('../../../config/cloudinary.js', () => ({
  getCloudinary: () => ({ uploader: { upload_stream: mockUploadStream } }),
}));

/* ── App + auth fixtures ────────────────────────────────────────────────── */

let app: Express;
let wholesalerCookie: string;
let buyerCookie: string;

beforeAll(async () => {
  await setupTestDb();
  const { createProductTestApp } = await import('./test-app.js');
  app = createProductTestApp();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  jest.clearAllMocks();
  await cleanTables();
  const db = getTestDb();

  const [org] = await db('organizations')
    .insert({ name: 'Org Upload', type: 'wholesaler', status: 'active' })
    .returning('id');
  const hash = await bcrypt.hash('TestPass123!', 12);

  await db('users').insert({
    email: 'wholesaler@test.com',
    password_hash: hash,
    role: 'wholesaler_admin',
    organization_id: org!.id,
    first_name: 'Wholesaler',
    last_name: 'Upload',
    phone: '+2250701010101',
  });
  await db('users').insert({
    email: 'buyer@test.com',
    password_hash: hash,
    role: 'buyer',
    organization_id: null,
    first_name: 'Buyer',
    last_name: 'Upload',
    phone: '+2250701010102',
  });

  const loginW = await request(app).post('/api/auth/login').send({ email: 'wholesaler@test.com', password: 'TestPass123!' });
  wholesalerCookie = (loginW.headers['set-cookie'] as string[])
    .find((c) => c.startsWith('access_token='))!.split(';')[0]!;

  const loginB = await request(app).post('/api/auth/login').send({ email: 'buyer@test.com', password: 'TestPass123!' });
  buyerCookie = (loginB.headers['set-cookie'] as string[])
    .find((c) => c.startsWith('access_token='))!.split(';')[0]!;
});

/* ── Tests ──────────────────────────────────────────────────────────────── */

describe('POST /api/products/upload-image', () => {
  it('wholesaler uploads a valid image → 200 + { url }', async () => {
    const res = await request(app)
      .post('/api/products/upload-image')
      .set('Cookie', [wholesalerCookie])
      .attach('image', Buffer.from('fake-png-bytes'), { filename: 'tissu.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body.url).toBe(FAKE_URL);
    expect(mockUploadStream).toHaveBeenCalledTimes(1);
  });

  it('no file attached → 422 ValidationError', async () => {
    const res = await request(app)
      .post('/api/products/upload-image')
      .set('Cookie', [wholesalerCookie]);

    expect(res.status).toBe(422);
    expect(mockUploadStream).not.toHaveBeenCalled();
  });

  it('buyer (wrong role) → 404 (anti-info-leak §14)', async () => {
    const res = await request(app)
      .post('/api/products/upload-image')
      .set('Cookie', [buyerCookie])
      .attach('image', Buffer.from('fake-png-bytes'), { filename: 'tissu.png', contentType: 'image/png' });

    expect(res.status).toBe(404);
    expect(mockUploadStream).not.toHaveBeenCalled();
  });

  it('unauthenticated → 401', async () => {
    const res = await request(app)
      .post('/api/products/upload-image')
      .attach('image', Buffer.from('fake-png-bytes'), { filename: 'tissu.png', contentType: 'image/png' });

    expect(res.status).toBe(401);
    expect(mockUploadStream).not.toHaveBeenCalled();
  });

  it('non-image MIME type → rejeté par le fileFilter multer', async () => {
    const res = await request(app)
      .post('/api/products/upload-image')
      .set('Cookie', [wholesalerCookie])
      .attach('image', Buffer.from('not-an-image'), { filename: 'doc.pdf', contentType: 'application/pdf' });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(mockUploadStream).not.toHaveBeenCalled();
  });
});
