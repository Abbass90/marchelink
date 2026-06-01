import request from 'supertest';
import { setupTestDb, teardownTestDb, cleanTables, getTestDb } from '../../auth/__tests__/setup.js';
import { createOrderTestApp } from './test-app.js';
import bcrypt from 'bcrypt';

process.env.JWT_ACCESS_SECRET = 'test_access_secret_min_32_chars_xxxxxxxxxxxxx';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_min_32_chars_xxxxxxxxxxxx';
process.env.JWT_ACCESS_TTL_SEC = '900';
process.env.JWT_REFRESH_TTL_SEC = '604800';
process.env.COOKIE_SECURE = 'false';
process.env.NODE_ENV = 'test';

const app = createOrderTestApp();

let orgAId: string;
let orgBId: string;
let wholesalerACookie: string;
let wholesalerBCookie: string;
let buyerACookie: string;
let buyerBCookie: string;
let productAId: string;
let productBId: string;

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
  const [orgB] = await db('organizations').insert({ name: 'Org B', type: 'wholesaler', status: 'active' }).returning('id');
  orgAId = orgA!.id;
  orgBId = orgB!.id;

  const hash = await bcrypt.hash('TestPass123!', 12);

  await db('users').insert({
    email: 'admin-a@test.com',
    password_hash: hash,
    role: 'wholesaler_admin',
    organization_id: orgAId,
    first_name: 'Admin',
    last_name: 'A',
  });

  await db('users').insert({
    email: 'admin-b@test.com',
    password_hash: hash,
    role: 'wholesaler_admin',
    organization_id: orgBId,
    first_name: 'Admin',
    last_name: 'B',
  });

  await db('users').insert({
    email: 'buyer-a@test.com',
    password_hash: hash,
    role: 'buyer',
    organization_id: null,
    first_name: 'Buyer',
    last_name: 'A',
  });

  await db('users').insert({
    email: 'buyer-b@test.com',
    password_hash: hash,
    role: 'buyer',
    organization_id: null,
    first_name: 'Buyer',
    last_name: 'B',
  });

  // Login users
  const loginA = await request(app).post('/api/auth/login').send({ email: 'admin-a@test.com', password: 'TestPass123!' });
  wholesalerACookie = (loginA.headers['set-cookie'] as string[]).find((c: string) => c.startsWith('access_token='))!.split(';')[0]!;

  const loginB = await request(app).post('/api/auth/login').send({ email: 'admin-b@test.com', password: 'TestPass123!' });
  wholesalerBCookie = (loginB.headers['set-cookie'] as string[]).find((c: string) => c.startsWith('access_token='))!.split(';')[0]!;

  const loginBuyerA = await request(app).post('/api/auth/login').send({ email: 'buyer-a@test.com', password: 'TestPass123!' });
  buyerACookie = (loginBuyerA.headers['set-cookie'] as string[]).find((c: string) => c.startsWith('access_token='))!.split(';')[0]!;

  const loginBuyerB = await request(app).post('/api/auth/login').send({ email: 'buyer-b@test.com', password: 'TestPass123!' });
  buyerBCookie = (loginBuyerB.headers['set-cookie'] as string[]).find((c: string) => c.startsWith('access_token='))!.split(';')[0]!;

  // Create products
  const prodA = await request(app)
    .post('/api/products')
    .set('Cookie', [wholesalerACookie])
    .send({ sku: 'WAX-001', name: 'Tissu Wax', description: 'Tissu premium', price_xof: 15000, stock_qty: 100, unit: 'piece' });
  productAId = prodA.body.id;

  const prodB = await request(app)
    .post('/api/products')
    .set('Cookie', [wholesalerBCookie])
    .send({ sku: 'SPICE-001', name: 'Poivre Noir', description: 'Epice', price_xof: 5000, stock_qty: 50, unit: 'kg' });
  productBId = prodB.body.id;
});

describe('UC-12: buyer places an order (mono-wholesaler)', () => {
  it('places an order with items from one wholesaler', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Cookie', [buyerACookie])
      .send({
        wholesaler_org_id: orgAId,
        items: [{ product_id: productAId, quantity: 3 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
    expect(res.body.total_xof).toBe('45000');
    expect(res.body.wholesaler_org_id).toBe(orgAId);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].quantity).toBe(3);
  });

  it('rejects order with product from different org', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Cookie', [buyerACookie])
      .send({
        wholesaler_org_id: orgAId,
        items: [{ product_id: productBId, quantity: 1 }],
      });

    expect(res.status).toBe(422);
  });

  it('rejects order when stock is insufficient', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Cookie', [buyerACookie])
      .send({
        wholesaler_org_id: orgAId,
        items: [{ product_id: productAId, quantity: 999 }],
      });

    expect(res.status).toBe(422);
  });

  it('decrements stock after successful order', async () => {
    await request(app)
      .post('/api/orders')
      .set('Cookie', [buyerACookie])
      .send({
        wholesaler_org_id: orgAId,
        items: [{ product_id: productAId, quantity: 10 }],
      });

    const db = getTestDb();
    const product = await db('products').where({ id: productAId }).first();
    expect(product.stock_qty).toBe(90);
  });
});

describe('UC-11: buyer views their orders', () => {
  it('buyer sees only their own orders', async () => {
    await request(app)
      .post('/api/orders')
      .set('Cookie', [buyerACookie])
      .send({ wholesaler_org_id: orgAId, items: [{ product_id: productAId, quantity: 1 }] });

    await request(app)
      .post('/api/orders')
      .set('Cookie', [buyerBCookie])
      .send({ wholesaler_org_id: orgAId, items: [{ product_id: productAId, quantity: 2 }] });

    const resA = await request(app).get('/api/orders/my').set('Cookie', [buyerACookie]);
    expect(resA.status).toBe(200);
    expect(resA.body).toHaveLength(1);

    const resB = await request(app).get('/api/orders/my').set('Cookie', [buyerBCookie]);
    expect(resB.body).toHaveLength(1);
  });
});

describe('UC-04: wholesaler sees orders for their org', () => {
  it('wholesaler A sees orders placed to org A', async () => {
    await request(app)
      .post('/api/orders')
      .set('Cookie', [buyerACookie])
      .send({ wholesaler_org_id: orgAId, items: [{ product_id: productAId, quantity: 1 }] });

    await request(app)
      .post('/api/orders')
      .set('Cookie', [buyerACookie])
      .send({ wholesaler_org_id: orgBId, items: [{ product_id: productBId, quantity: 1 }] });

    const res = await request(app).get('/api/orders/org').set('Cookie', [wholesalerACookie]);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].wholesaler_org_id).toBe(orgAId);
  });
});

describe('UC-05: wholesaler accepts or rejects a pending order', () => {
  it('wholesaler accepts a pending order', async () => {
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Cookie', [buyerACookie])
      .send({ wholesaler_org_id: orgAId, items: [{ product_id: productAId, quantity: 1 }] });

    const res = await request(app)
      .patch(`/api/orders/org/${orderRes.body.id}/status`)
      .set('Cookie', [wholesalerACookie])
      .send({ status: 'accepted' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('accepted');
  });

  it('wholesaler rejects a pending order', async () => {
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Cookie', [buyerACookie])
      .send({ wholesaler_org_id: orgAId, items: [{ product_id: productAId, quantity: 1 }] });

    const res = await request(app)
      .patch(`/api/orders/org/${orderRes.body.id}/status`)
      .set('Cookie', [wholesalerACookie])
      .send({ status: 'rejected' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rejected');
  });

  it('cannot accept an already accepted order', async () => {
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Cookie', [buyerACookie])
      .send({ wholesaler_org_id: orgAId, items: [{ product_id: productAId, quantity: 1 }] });

    await request(app)
      .patch(`/api/orders/org/${orderRes.body.id}/status`)
      .set('Cookie', [wholesalerACookie])
      .send({ status: 'accepted' });

    const res = await request(app)
      .patch(`/api/orders/org/${orderRes.body.id}/status`)
      .set('Cookie', [wholesalerACookie])
      .send({ status: 'accepted' });

    expect(res.status).toBe(422);
  });

  it('wholesaler B cannot change status of org A order (404)', async () => {
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Cookie', [buyerACookie])
      .send({ wholesaler_org_id: orgAId, items: [{ product_id: productAId, quantity: 1 }] });

    const res = await request(app)
      .patch(`/api/orders/org/${orderRes.body.id}/status`)
      .set('Cookie', [wholesalerBCookie])
      .send({ status: 'accepted' });

    expect(res.status).toBe(404);
  });
});

describe('UC-13: wholesaler ships then delivers a paid order', () => {
  it('marks a paid order as shipped, then delivered', async () => {
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Cookie', [buyerACookie])
      .send({ wholesaler_org_id: orgAId, items: [{ product_id: productAId, quantity: 1 }] });
    const orderId = orderRes.body.id;

    // Le webhook de paiement n'est pas câblé dans ce test-app : on force 'paid' en base.
    await getTestDb()('orders').where({ id: orderId }).update({ status: 'paid' });

    const shipRes = await request(app)
      .patch(`/api/orders/org/${orderId}/status`)
      .set('Cookie', [wholesalerACookie])
      .send({ status: 'shipped' });
    expect(shipRes.status).toBe(200);
    expect(shipRes.body.status).toBe('shipped');

    const deliverRes = await request(app)
      .patch(`/api/orders/org/${orderId}/status`)
      .set('Cookie', [wholesalerACookie])
      .send({ status: 'delivered' });
    expect(deliverRes.status).toBe(200);
    expect(deliverRes.body.status).toBe('delivered');
  });

  it('cannot ship an order that is not paid (still pending)', async () => {
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Cookie', [buyerACookie])
      .send({ wholesaler_org_id: orgAId, items: [{ product_id: productAId, quantity: 1 }] });

    const res = await request(app)
      .patch(`/api/orders/org/${orderRes.body.id}/status`)
      .set('Cookie', [wholesalerACookie])
      .send({ status: 'shipped' });

    expect(res.status).toBe(422);
  });

  it('cannot mark delivered an order that is not shipped (paid)', async () => {
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Cookie', [buyerACookie])
      .send({ wholesaler_org_id: orgAId, items: [{ product_id: productAId, quantity: 1 }] });
    const orderId = orderRes.body.id;

    await getTestDb()('orders').where({ id: orderId }).update({ status: 'paid' });

    const res = await request(app)
      .patch(`/api/orders/org/${orderId}/status`)
      .set('Cookie', [wholesalerACookie])
      .send({ status: 'delivered' });

    expect(res.status).toBe(422);
  });

  it('wholesaler B cannot ship an org A order (404)', async () => {
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Cookie', [buyerACookie])
      .send({ wholesaler_org_id: orgAId, items: [{ product_id: productAId, quantity: 1 }] });
    const orderId = orderRes.body.id;

    await getTestDb()('orders').where({ id: orderId }).update({ status: 'paid' });

    const res = await request(app)
      .patch(`/api/orders/org/${orderId}/status`)
      .set('Cookie', [wholesalerBCookie])
      .send({ status: 'shipped' });

    expect(res.status).toBe(404);
  });
});

describe('UC-15: buyer cannot see or modify another buyer order', () => {
  it('buyer B cannot view buyer A order', async () => {
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Cookie', [buyerACookie])
      .send({ wholesaler_org_id: orgAId, items: [{ product_id: productAId, quantity: 1 }] });

    const res = await request(app)
      .get(`/api/orders/my/${orderRes.body.id}`)
      .set('Cookie', [buyerBCookie]);

    expect(res.status).toBe(404);
  });

  it('buyer B cannot cancel buyer A order', async () => {
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Cookie', [buyerACookie])
      .send({ wholesaler_org_id: orgAId, items: [{ product_id: productAId, quantity: 1 }] });

    const res = await request(app)
      .patch(`/api/orders/my/${orderRes.body.id}/cancel`)
      .set('Cookie', [buyerBCookie]);

    expect(res.status).toBe(404);
  });

  it('buyer can cancel their own pending order', async () => {
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Cookie', [buyerACookie])
      .send({ wholesaler_org_id: orgAId, items: [{ product_id: productAId, quantity: 1 }] });

    const res = await request(app)
      .patch(`/api/orders/my/${orderRes.body.id}/cancel`)
      .set('Cookie', [buyerACookie]);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
  });

  it('buyer cannot cancel an accepted order', async () => {
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Cookie', [buyerACookie])
      .send({ wholesaler_org_id: orgAId, items: [{ product_id: productAId, quantity: 1 }] });

    await request(app)
      .patch(`/api/orders/org/${orderRes.body.id}/status`)
      .set('Cookie', [wholesalerACookie])
      .send({ status: 'accepted' });

    const res = await request(app)
      .patch(`/api/orders/my/${orderRes.body.id}/cancel`)
      .set('Cookie', [buyerACookie]);

    expect(res.status).toBe(422);
  });
});
