import request from 'supertest';
import { setupTestDb, teardownTestDb, cleanTables, getTestDb } from '../../auth/__tests__/setup.js';
import { createDeliveryTestApp } from './test-app.js';
import bcrypt from 'bcrypt';

process.env.JWT_ACCESS_SECRET = 'test_access_secret_min_32_chars_xxxxxxxxxxxxx';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_min_32_chars_xxxxxxxxxxxx';
process.env.JWT_ACCESS_TTL_SEC = '900';
process.env.JWT_REFRESH_TTL_SEC = '604800';
process.env.COOKIE_SECURE = 'false';
process.env.NODE_ENV = 'test';

const app = createDeliveryTestApp();

let orgAId: string;
let orgBId: string;
let wholesalerACookie: string;
let wholesalerBCookie: string;
let buyerCookie: string;
let operatorAId: string;
let operatorACookie: string;
let operatorBId: string;
let operatorBCookie: string;
let paidOrderId: string;

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

  const [opA] = await db('users').insert({
    email: 'operator-a@test.com',
    password_hash: hash,
    role: 'delivery_operator',
    organization_id: orgAId,
    first_name: 'Operator',
    last_name: 'A',
  }).returning('id');
  operatorAId = opA!.id;

  const [opB] = await db('users').insert({
    email: 'operator-b@test.com',
    password_hash: hash,
    role: 'delivery_operator',
    organization_id: orgBId,
    first_name: 'Operator',
    last_name: 'B',
  }).returning('id');
  operatorBId = opB!.id;

  await db('users').insert({
    email: 'buyer@test.com',
    password_hash: hash,
    role: 'buyer',
    organization_id: null,
    first_name: 'Buyer',
    last_name: 'Test',
  });

  // Login
  const loginA = await request(app).post('/api/auth/login').send({ email: 'admin-a@test.com', password: 'TestPass123!' });
  wholesalerACookie = (loginA.headers['set-cookie'] as string[]).find((c: string) => c.startsWith('access_token='))!.split(';')[0]!;

  const loginB = await request(app).post('/api/auth/login').send({ email: 'admin-b@test.com', password: 'TestPass123!' });
  wholesalerBCookie = (loginB.headers['set-cookie'] as string[]).find((c: string) => c.startsWith('access_token='))!.split(';')[0]!;

  const loginOpA = await request(app).post('/api/auth/login').send({ email: 'operator-a@test.com', password: 'TestPass123!' });
  operatorACookie = (loginOpA.headers['set-cookie'] as string[]).find((c: string) => c.startsWith('access_token='))!.split(';')[0]!;

  const loginOpB = await request(app).post('/api/auth/login').send({ email: 'operator-b@test.com', password: 'TestPass123!' });
  operatorBCookie = (loginOpB.headers['set-cookie'] as string[]).find((c: string) => c.startsWith('access_token='))!.split(';')[0]!;

  const loginBuyer = await request(app).post('/api/auth/login').send({ email: 'buyer@test.com', password: 'TestPass123!' });
  buyerCookie = (loginBuyer.headers['set-cookie'] as string[]).find((c: string) => c.startsWith('access_token='))!.split(';')[0]!;

  // Create product, place order, accept, mark as paid
  const prodRes = await request(app)
    .post('/api/products')
    .set('Cookie', [wholesalerACookie])
    .send({ sku: 'WAX-001', name: 'Tissu Wax', description: 'Premium', price_xof: 15000, stock_qty: 100, unit: 'piece' });

  const orderRes = await request(app)
    .post('/api/orders')
    .set('Cookie', [buyerCookie])
    .send({ wholesaler_org_id: orgAId, items: [{ product_id: prodRes.body.id, quantity: 2 }] });

  await request(app)
    .patch(`/api/orders/org/${orderRes.body.id}/status`)
    .set('Cookie', [wholesalerACookie])
    .send({ status: 'accepted' });

  // Manually set order to 'paid' (simulating webhook)
  await db('orders').where({ id: orderRes.body.id }).update({ status: 'paid' });
  paidOrderId = orderRes.body.id;
});

describe('UC-06: wholesaler assigns delivery to operator', () => {
  it('assigns a delivery on a paid order', async () => {
    const res = await request(app)
      .post('/api/deliveries')
      .set('Cookie', [wholesalerACookie])
      .send({ order_id: paidOrderId, assigned_to_user_id: operatorAId });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('assigned');
    expect(res.body.assigned_to_user_id).toBe(operatorAId);
    expect(res.body.wholesaler_org_id).toBe(orgAId);
  });

  it('rejects assignment on non-paid order', async () => {
    const db = getTestDb();
    await db('orders').where({ id: paidOrderId }).update({ status: 'accepted' });

    const res = await request(app)
      .post('/api/deliveries')
      .set('Cookie', [wholesalerACookie])
      .send({ order_id: paidOrderId, assigned_to_user_id: operatorAId });

    expect(res.status).toBe(422);
  });

  it('rejects assignment to operator from another org', async () => {
    const res = await request(app)
      .post('/api/deliveries')
      .set('Cookie', [wholesalerACookie])
      .send({ order_id: paidOrderId, assigned_to_user_id: operatorBId });

    expect(res.status).toBe(422);
  });

  it('rejects duplicate assignment', async () => {
    await request(app)
      .post('/api/deliveries')
      .set('Cookie', [wholesalerACookie])
      .send({ order_id: paidOrderId, assigned_to_user_id: operatorAId });

    const res = await request(app)
      .post('/api/deliveries')
      .set('Cookie', [wholesalerACookie])
      .send({ order_id: paidOrderId, assigned_to_user_id: operatorAId });

    expect(res.status).toBe(422);
  });
});

describe('UC-17: delivery_operator sees only their assigned deliveries', () => {
  it('operator A sees only their deliveries', async () => {
    await request(app)
      .post('/api/deliveries')
      .set('Cookie', [wholesalerACookie])
      .send({ order_id: paidOrderId, assigned_to_user_id: operatorAId });

    const resA = await request(app)
      .get('/api/deliveries/mine')
      .set('Cookie', [operatorACookie]);

    expect(resA.status).toBe(200);
    expect(resA.body).toHaveLength(1);
    expect(resA.body[0].assigned_to_user_id).toBe(operatorAId);

    const resB = await request(app)
      .get('/api/deliveries/mine')
      .set('Cookie', [operatorBCookie]);

    expect(resB.status).toBe(200);
    expect(resB.body).toHaveLength(0);
  });
});

describe('UC-18: delivery_operator marks delivery as delivered', () => {
  it('operator marks delivery as delivered, order transitions to delivered', async () => {
    const assignRes = await request(app)
      .post('/api/deliveries')
      .set('Cookie', [wholesalerACookie])
      .send({ order_id: paidOrderId, assigned_to_user_id: operatorAId });

    const res = await request(app)
      .patch(`/api/deliveries/${assignRes.body.id}/delivered`)
      .set('Cookie', [operatorACookie]);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('delivered');
    expect(res.body.completed_at).not.toBeNull();

    // Verify order status
    const db = getTestDb();
    const order = await db('orders').where({ id: paidOrderId }).first();
    expect(order.status).toBe('delivered');
  });
});

describe('UC-16: buyer sees delivered status', () => {
  it('buyer sees order status as delivered after operator marks it', async () => {
    const assignRes = await request(app)
      .post('/api/deliveries')
      .set('Cookie', [wholesalerACookie])
      .send({ order_id: paidOrderId, assigned_to_user_id: operatorAId });

    await request(app)
      .patch(`/api/deliveries/${assignRes.body.id}/delivered`)
      .set('Cookie', [operatorACookie]);

    const res = await request(app)
      .get(`/api/orders/my/${paidOrderId}`)
      .set('Cookie', [buyerCookie]);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('delivered');
  });
});

describe('UC-19: delivery_operator cannot mark delivery from another tenant', () => {
  it('operator B cannot mark org A delivery as delivered (404)', async () => {
    const assignRes = await request(app)
      .post('/api/deliveries')
      .set('Cookie', [wholesalerACookie])
      .send({ order_id: paidOrderId, assigned_to_user_id: operatorAId });

    const res = await request(app)
      .patch(`/api/deliveries/${assignRes.body.id}/delivered`)
      .set('Cookie', [operatorBCookie]);

    expect(res.status).toBe(404);
  });
});
