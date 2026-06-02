import request from 'supertest';
import { setupTestDb, teardownTestDb, cleanTables, getTestDb } from '../../auth/__tests__/setup.js';
import { createPaymentTestApp } from './test-app.js';
import bcrypt from 'bcrypt';

process.env.JWT_ACCESS_SECRET = 'test_access_secret_min_32_chars_xxxxxxxxxxxxx';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_min_32_chars_xxxxxxxxxxxx';
process.env.JWT_ACCESS_TTL_SEC = '900';
process.env.JWT_REFRESH_TTL_SEC = '604800';
process.env.COOKIE_SECURE = 'false';
process.env.NODE_ENV = 'test';

const app = createPaymentTestApp();
const rateLimitedApp = createPaymentTestApp({ enableWebhookRateLimit: true });

let orgAId: string;
let wholesalerACookie: string;
let buyerCookie: string;
let productAId: string;
let acceptedOrderId: string;
let paymentIdempotencyKey: string;

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanTables();
  const db = getTestDb();

  const [orgA] = await db('organizations').insert({ name: 'Org A', type: 'wholesaler', status: 'active' }).returning('id');
  orgAId = orgA!.id;

  const hash = await bcrypt.hash('TestPass123!', 12);

  await db('users').insert({
    email: 'admin-a@test.com',
    password_hash: hash,
    role: 'wholesaler_admin',
    organization_id: orgAId,
    first_name: 'Admin',
    last_name: 'A',
    phone: '+2250701010101',
  });

  await db('users').insert({
    email: 'buyer@test.com',
    password_hash: hash,
    role: 'buyer',
    organization_id: null,
    first_name: 'Buyer',
    last_name: 'Test',
    phone: '+2250701010102',
  });

  // Login
  const loginA = await request(app).post('/api/auth/login').send({ email: 'admin-a@test.com', password: 'TestPass123!' });
  wholesalerACookie = (loginA.headers['set-cookie'] as string[]).find((c: string) => c.startsWith('access_token='))!.split(';')[0]!;

  const loginBuyer = await request(app).post('/api/auth/login').send({ email: 'buyer@test.com', password: 'TestPass123!' });
  buyerCookie = (loginBuyer.headers['set-cookie'] as string[]).find((c: string) => c.startsWith('access_token='))!.split(';')[0]!;

  // Create product
  const prodRes = await request(app)
    .post('/api/products')
    .set('Cookie', [wholesalerACookie])
    .send({ sku: 'WAX-001', name: 'Tissu Wax', description: 'Premium', price_xof: 15000, stock_qty: 100, unit: 'piece' });
  productAId = prodRes.body.id;

  // Place order
  const orderRes = await request(app)
    .post('/api/orders')
    .set('Cookie', [buyerCookie])
    .send({ wholesaler_org_id: orgAId, items: [{ product_id: productAId, quantity: 2 }] });
  const orderId = orderRes.body.id;

  // Wholesaler accepts order
  await request(app)
    .patch(`/api/orders/org/${orderId}/status`)
    .set('Cookie', [wholesalerACookie])
    .send({ status: 'accepted' });

  acceptedOrderId = orderId;
});

describe('UC-13: buyer initiates Mobile Money payment', () => {
  it('initiates payment on an accepted order', async () => {
    const res = await request(app)
      .post('/api/payments/initiate')
      .set('Cookie', [buyerCookie])
      .send({ order_id: acceptedOrderId, phone_number: '+2250700000000' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
    expect(res.body.amount_xof).toBe('30000');
    expect(res.body.order_id).toBe(acceptedOrderId);
    expect(res.body.idempotency_key).toBeDefined();
    paymentIdempotencyKey = res.body.idempotency_key;
  });

  it('returns existing pending payment if called again', async () => {
    const res1 = await request(app)
      .post('/api/payments/initiate')
      .set('Cookie', [buyerCookie])
      .send({ order_id: acceptedOrderId, phone_number: '+2250700000000' });

    const res2 = await request(app)
      .post('/api/payments/initiate')
      .set('Cookie', [buyerCookie])
      .send({ order_id: acceptedOrderId, phone_number: '+2250700000000' });

    expect(res2.status).toBe(201);
    expect(res2.body.id).toBe(res1.body.id);
  });

  it('rejects payment on a pending (not accepted) order', async () => {
    const db = getTestDb();
    // Revert order to pending for this test
    await db('orders').where({ id: acceptedOrderId }).update({ status: 'pending' });

    const res = await request(app)
      .post('/api/payments/initiate')
      .set('Cookie', [buyerCookie])
      .send({ order_id: acceptedOrderId, phone_number: '+2250700000000' });

    expect(res.status).toBe(422);
  });

  it('rejects payment on non-existent order', async () => {
    const res = await request(app)
      .post('/api/payments/initiate')
      .set('Cookie', [buyerCookie])
      .send({ order_id: '00000000-0000-0000-0000-000000000000', phone_number: '+2250700000000' });

    expect(res.status).toBe(404);
  });
});

describe('UC-14: webhook confirms payment → order becomes paid', () => {
  it('webhook completes payment and transitions order to paid', async () => {
    // Initiate payment first
    const initRes = await request(app)
      .post('/api/payments/initiate')
      .set('Cookie', [buyerCookie])
      .send({ order_id: acceptedOrderId, phone_number: '+2250700000000' });

    const key = initRes.body.idempotency_key;

    // Webhook confirms
    const webhookRes = await request(app)
      .post('/api/payments/webhook')
      .send({ idempotency_key: key, provider_ref: 'MOMO_REF_123', status: 'completed' });

    expect(webhookRes.status).toBe(200);
    expect(webhookRes.body.already_processed).toBe(false);
    expect(webhookRes.body.payment.status).toBe('completed');

    // Verify order status is now 'paid'
    const db = getTestDb();
    const order = await db('orders').where({ id: acceptedOrderId }).first();
    expect(order.status).toBe('paid');
  });

  it('webhook with failed status does not change order to paid', async () => {
    const initRes = await request(app)
      .post('/api/payments/initiate')
      .set('Cookie', [buyerCookie])
      .send({ order_id: acceptedOrderId, phone_number: '+2250700000000' });

    const key = initRes.body.idempotency_key;

    const webhookRes = await request(app)
      .post('/api/payments/webhook')
      .send({ idempotency_key: key, provider_ref: 'MOMO_FAIL_456', status: 'failed' });

    expect(webhookRes.status).toBe(200);
    expect(webhookRes.body.payment.status).toBe('failed');

    const db = getTestDb();
    const order = await db('orders').where({ id: acceptedOrderId }).first();
    expect(order.status).toBe('accepted');
  });
});

describe('UC-22: idempotence — double webhook does not duplicate', () => {
  it('replayed webhook returns success without re-processing', async () => {
    const initRes = await request(app)
      .post('/api/payments/initiate')
      .set('Cookie', [buyerCookie])
      .send({ order_id: acceptedOrderId, phone_number: '+2250700000000' });

    const key = initRes.body.idempotency_key;

    // First call
    await request(app)
      .post('/api/payments/webhook')
      .send({ idempotency_key: key, provider_ref: 'MOMO_REF_789', status: 'completed' });

    // Replay
    const replayRes = await request(app)
      .post('/api/payments/webhook')
      .send({ idempotency_key: key, provider_ref: 'MOMO_REF_789', status: 'completed' });

    expect(replayRes.status).toBe(200);
    expect(replayRes.body.already_processed).toBe(true);

    // Verify only one payment record exists
    const db = getTestDb();
    const payments = await db('payments').where({ order_id: acceptedOrderId });
    expect(payments).toHaveLength(1);
  });

  it('webhook with unknown idempotency key returns 404', async () => {
    const res = await request(app)
      .post('/api/payments/webhook')
      .send({ idempotency_key: 'unknown_key_xyz', provider_ref: 'REF', status: 'completed' });

    expect(res.status).toBe(404);
  });
});

describe('UC-F4: buyer liste ses paiements', () => {
  it('retourne une liste vide quand aucun paiement', async () => {
    const res = await request(app)
      .get('/api/payments/my')
      .set('Cookie', [buyerCookie]);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('retourne les paiements après webhook completed', async () => {
    const initRes = await request(app)
      .post('/api/payments/initiate')
      .set('Cookie', [buyerCookie])
      .send({ order_id: acceptedOrderId, phone_number: '+2250700000000' });

    await request(app)
      .post('/api/payments/webhook')
      .send({ idempotency_key: initRes.body.idempotency_key, provider_ref: 'MOMO_REF', status: 'completed' });

    const res = await request(app)
      .get('/api/payments/my')
      .set('Cookie', [buyerCookie]);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].order_id).toBe(acceptedOrderId);
    expect(res.body[0].status).toBe('completed');
    expect(res.body[0].provider_ref).toBe('MOMO_REF');
  });

  it('isolation cross-tenant : buyer2 ne voit pas les paiements de buyer1', async () => {
    const initRes = await request(app)
      .post('/api/payments/initiate')
      .set('Cookie', [buyerCookie])
      .send({ order_id: acceptedOrderId, phone_number: '+2250700000000' });

    await request(app)
      .post('/api/payments/webhook')
      .send({ idempotency_key: initRes.body.idempotency_key, provider_ref: 'REF', status: 'completed' });

    const db = getTestDb();
    const hash = await bcrypt.hash('TestPass123!', 12);
    await db('users').insert({
      email: 'buyer2@test.com',
      password_hash: hash,
      role: 'buyer',
      organization_id: null,
      first_name: 'Buyer',
      last_name: 'Two',
      phone: '+2250701010199',
    });
    const login2 = await request(app).post('/api/auth/login').send({ email: 'buyer2@test.com', password: 'TestPass123!' });
    const buyer2Cookie = (login2.headers['set-cookie'] as string[])
      .find((c: string) => c.startsWith('access_token='))!.split(';')[0]!;

    const res = await request(app)
      .get('/api/payments/my')
      .set('Cookie', [buyer2Cookie]);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});

describe('UC-F4: grossiste liste les paiements de son org', () => {
  it('retourne une liste vide quand aucun paiement', async () => {
    const res = await request(app)
      .get('/api/payments/org')
      .set('Cookie', [wholesalerACookie]);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('retourne les paiements de l\'org après webhook completed', async () => {
    const initRes = await request(app)
      .post('/api/payments/initiate')
      .set('Cookie', [buyerCookie])
      .send({ order_id: acceptedOrderId, phone_number: '+2250700000000' });

    await request(app)
      .post('/api/payments/webhook')
      .send({ idempotency_key: initRes.body.idempotency_key, provider_ref: 'MOMO_GROSS', status: 'completed' });

    const res = await request(app)
      .get('/api/payments/org')
      .set('Cookie', [wholesalerACookie]);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].wholesaler_org_id).toBe(orgAId);
    expect(res.body[0].status).toBe('completed');
  });

  it('isolation cross-tenant : orgB ne voit pas les paiements de orgA', async () => {
    const initRes = await request(app)
      .post('/api/payments/initiate')
      .set('Cookie', [buyerCookie])
      .send({ order_id: acceptedOrderId, phone_number: '+2250700000000' });

    await request(app)
      .post('/api/payments/webhook')
      .send({ idempotency_key: initRes.body.idempotency_key, provider_ref: 'REF', status: 'completed' });

    const db = getTestDb();
    const hash = await bcrypt.hash('TestPass123!', 12);
    const [orgB] = await db('organizations').insert({ name: 'Org B', type: 'wholesaler', status: 'active' }).returning('id');
    await db('users').insert({
      email: 'admin-b@test.com',
      password_hash: hash,
      role: 'wholesaler_admin',
      organization_id: orgB!.id,
      first_name: 'Admin',
      last_name: 'B',
      phone: '+2250701010198',
    });
    const loginB = await request(app).post('/api/auth/login').send({ email: 'admin-b@test.com', password: 'TestPass123!' });
    const wholesalerBCookie = (loginB.headers['set-cookie'] as string[])
      .find((c: string) => c.startsWith('access_token='))!.split(';')[0]!;

    const res = await request(app)
      .get('/api/payments/org')
      .set('Cookie', [wholesalerBCookie]);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});

describe('UC-22: webhook rate limiting (20 req/min)', () => {
  it('blocks after 20 requests', async () => {
    const promises = [];
    for (let i = 0; i < 21; i++) {
      promises.push(
        request(rateLimitedApp)
          .post('/api/payments/webhook')
          .send({ idempotency_key: `key_${i}`, provider_ref: 'REF', status: 'completed' }),
      );
    }
    const results = await Promise.all(promises);
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(1);
  });
});
