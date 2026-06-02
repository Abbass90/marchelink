import request from 'supertest';
import { setupTestDb, teardownTestDb, cleanTables, getTestDb } from '../../auth/__tests__/setup.js';
import { createDashboardTestApp } from './test-app.js';
import bcrypt from 'bcrypt';

process.env.JWT_ACCESS_SECRET = 'test_access_secret_min_32_chars_xxxxxxxxxxxxx';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_min_32_chars_xxxxxxxxxxxx';
process.env.JWT_ACCESS_TTL_SEC = '900';
process.env.JWT_REFRESH_TTL_SEC = '604800';
process.env.COOKIE_SECURE = 'false';
process.env.NODE_ENV = 'test';

const app = createDashboardTestApp();

let orgAId: string;
let wholesalerACookie: string;
let buyerCookie: string;

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

  const loginA = await request(app).post('/api/auth/login').send({ email: 'admin-a@test.com', password: 'TestPass123!' });
  wholesalerACookie = (loginA.headers['set-cookie'] as string[]).find((c: string) => c.startsWith('access_token='))!.split(';')[0]!;

  const loginBuyer = await request(app).post('/api/auth/login').send({ email: 'buyer@test.com', password: 'TestPass123!' });
  buyerCookie = (loginBuyer.headers['set-cookie'] as string[]).find((c: string) => c.startsWith('access_token='))!.split(';')[0]!;
});

describe('UC-07: wholesaler dashboard stats', () => {
  it('returns zero stats when no orders exist', async () => {
    const res = await request(app)
      .get('/api/dashboard')
      .set('Cookie', [wholesalerACookie]);

    expect(res.status).toBe(200);
    expect(res.body.revenue_today_xof).toBe(0);
    expect(res.body.orders_today).toBe(0);
    expect(res.body.orders_pending).toBe(0);
    expect(res.body.low_stock_products).toEqual([]);
  });

  it('computes revenue from paid/delivered orders today', async () => {
    const db = getTestDb();
    const [buyer] = await db('users').where({ email: 'buyer@test.com' }).select('id');

    // Insert a paid order for today
    await db('orders').insert({
      wholesaler_org_id: orgAId,
      buyer_user_id: buyer!.id,
      status: 'paid',
      total_xof: 30000,
    });

    // Insert a delivered order for today
    await db('orders').insert({
      wholesaler_org_id: orgAId,
      buyer_user_id: buyer!.id,
      status: 'delivered',
      total_xof: 15000,
    });

    // Insert a pending order (should NOT count in revenue)
    await db('orders').insert({
      wholesaler_org_id: orgAId,
      buyer_user_id: buyer!.id,
      status: 'pending',
      total_xof: 5000,
    });

    const res = await request(app)
      .get('/api/dashboard')
      .set('Cookie', [wholesalerACookie]);

    expect(res.status).toBe(200);
    expect(res.body.revenue_today_xof).toBe(45000);
    expect(res.body.orders_today).toBe(3);
    expect(res.body.orders_pending).toBe(1);
  });

  it('returns low stock products (stock <= 10)', async () => {
    const db = getTestDb();

    await db('products').insert([
      { organization_id: orgAId, sku: 'LOW-001', name: 'Tissu épuisé', price_xof: 10000, stock_qty: 3, unit: 'piece' },
      { organization_id: orgAId, sku: 'LOW-002', name: 'Epice rare', price_xof: 5000, stock_qty: 10, unit: 'kg' },
      { organization_id: orgAId, sku: 'OK-001', name: 'Stock OK', price_xof: 8000, stock_qty: 50, unit: 'piece' },
    ]);

    const res = await request(app)
      .get('/api/dashboard')
      .set('Cookie', [wholesalerACookie]);

    expect(res.status).toBe(200);
    expect(res.body.low_stock_products).toHaveLength(2);
    expect(res.body.low_stock_products[0].name).toBe('Tissu épuisé');
    expect(res.body.low_stock_products[1].name).toBe('Epice rare');
  });

  it('buyer cannot access dashboard (404)', async () => {
    const res = await request(app)
      .get('/api/dashboard')
      .set('Cookie', [buyerCookie]);

    expect(res.status).toBe(404);
  });

  it('only shows data for own organization', async () => {
    const db = getTestDb();

    const [orgB] = await db('organizations').insert({ name: 'Org B', type: 'wholesaler', status: 'active' }).returning('id');
    const [buyer] = await db('users').where({ email: 'buyer@test.com' }).select('id');

    // Order for Org B — should not appear in Org A dashboard
    await db('orders').insert({
      wholesaler_org_id: orgB!.id,
      buyer_user_id: buyer!.id,
      status: 'paid',
      total_xof: 99000,
    });

    const res = await request(app)
      .get('/api/dashboard')
      .set('Cookie', [wholesalerACookie]);

    expect(res.status).toBe(200);
    expect(res.body.revenue_today_xof).toBe(0);
    expect(res.body.orders_today).toBe(0);
  });
});
