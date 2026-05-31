import request from 'supertest';
import { setupTestDb, teardownTestDb, cleanTables, getTestDb } from '../../auth/__tests__/setup.js';
import { createProductTestApp } from './test-app.js';
import bcrypt from 'bcrypt';

process.env.JWT_ACCESS_SECRET = 'test_access_secret_min_32_chars_xxxxxxxxxxxxx';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_min_32_chars_xxxxxxxxxxxx';
process.env.JWT_ACCESS_TTL_SEC = '900';
process.env.JWT_REFRESH_TTL_SEC = '604800';
process.env.COOKIE_SECURE = 'false';
process.env.NODE_ENV = 'test';

const app = createProductTestApp();

let orgAId: string;
let orgBId: string;
let wholesalerACookie: string;
let wholesalerBCookie: string;
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

  // Create 2 organizations
  const [orgA] = await db('organizations').insert({ name: 'Org A', type: 'wholesaler', status: 'active' }).returning('id');
  const [orgB] = await db('organizations').insert({ name: 'Org B', type: 'wholesaler', status: 'active' }).returning('id');
  orgAId = orgA!.id;
  orgBId = orgB!.id;

  const hash = await bcrypt.hash('TestPass123!', 12);

  // Wholesaler admin A
  await db('users').insert({
    email: 'admin-a@test.com',
    password_hash: hash,
    role: 'wholesaler_admin',
    organization_id: orgAId,
    first_name: 'Admin',
    last_name: 'A',
  });

  // Wholesaler admin B
  await db('users').insert({
    email: 'admin-b@test.com',
    password_hash: hash,
    role: 'wholesaler_admin',
    organization_id: orgBId,
    first_name: 'Admin',
    last_name: 'B',
  });

  // Buyer
  await db('users').insert({
    email: 'buyer@test.com',
    password_hash: hash,
    role: 'buyer',
    organization_id: null,
    first_name: 'Buyer',
    last_name: 'Test',
  });

  // Login all users
  const loginA = await request(app).post('/api/auth/login').send({ email: 'admin-a@test.com', password: 'TestPass123!' });
  const cookiesA = loginA.headers['set-cookie'] as string[];
  wholesalerACookie = cookiesA.find((c: string) => c.startsWith('access_token='))!.split(';')[0]!;

  const loginB = await request(app).post('/api/auth/login').send({ email: 'admin-b@test.com', password: 'TestPass123!' });
  const cookiesB = loginB.headers['set-cookie'] as string[];
  wholesalerBCookie = cookiesB.find((c: string) => c.startsWith('access_token='))!.split(';')[0]!;

  const loginBuyer = await request(app).post('/api/auth/login').send({ email: 'buyer@test.com', password: 'TestPass123!' });
  const cookiesBuyer = loginBuyer.headers['set-cookie'] as string[];
  buyerCookie = cookiesBuyer.find((c: string) => c.startsWith('access_token='))!.split(';')[0]!;
});

const validProduct = {
  sku: 'WAX-001',
  name: 'Tissu Wax Hollandais',
  description: 'Tissu wax premium 6 yards',
  price_xof: 15000,
  stock_qty: 100,
  unit: 'pièce',
};

describe('UC-01: wholesaler_admin creates a product', () => {
  it('creates a product in own catalog', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Cookie', [wholesalerACookie])
      .send(validProduct);

    expect(res.status).toBe(201);
    expect(res.body.name).toBe(validProduct.name);
    expect(res.body.organization_id).toBe(orgAId);
    expect(res.body.price_xof).toBe(String(validProduct.price_xof));
  });

  it('rejects invalid product payload', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Cookie', [wholesalerACookie])
      .send({ name: '' });

    expect(res.status).toBe(422);
  });
});

describe('UC-02: wholesaler_admin updates stock and price', () => {
  it('updates stock and price of own product', async () => {
    const createRes = await request(app)
      .post('/api/products')
      .set('Cookie', [wholesalerACookie])
      .send(validProduct);

    const productId = createRes.body.id;

    const updateRes = await request(app)
      .patch(`/api/products/${productId}`)
      .set('Cookie', [wholesalerACookie])
      .send({ price_xof: 18000, stock_qty: 50 });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.price_xof).toBe('18000');
    expect(updateRes.body.stock_qty).toBe(50);
  });
});

describe('UC-03: wholesaler_admin cannot see product from another tenant', () => {
  it('returns 404 when trying to access another org product', async () => {
    // Org A creates a product
    const createRes = await request(app)
      .post('/api/products')
      .set('Cookie', [wholesalerACookie])
      .send(validProduct);

    const productId = createRes.body.id;

    // Org B tries to update it → 404
    const updateRes = await request(app)
      .patch(`/api/products/${productId}`)
      .set('Cookie', [wholesalerBCookie])
      .send({ price_xof: 1 });

    expect(updateRes.status).toBe(404);
  });

  it('org B cannot delete org A product', async () => {
    const createRes = await request(app)
      .post('/api/products')
      .set('Cookie', [wholesalerACookie])
      .send(validProduct);

    const res = await request(app)
      .delete(`/api/products/${createRes.body.id}`)
      .set('Cookie', [wholesalerBCookie]);

    expect(res.status).toBe(404);
  });
});

describe('UC-09: buyer browses all wholesalers catalogs', () => {
  beforeEach(async () => {
    // Org A creates 2 products (1 in stock, 1 out of stock)
    await request(app).post('/api/products').set('Cookie', [wholesalerACookie])
      .send({ ...validProduct, sku: 'WAX-001', name: 'Tissu Wax', price_xof: 15000, stock_qty: 100 });
    await request(app).post('/api/products').set('Cookie', [wholesalerACookie])
      .send({ ...validProduct, sku: 'RIZ-001', name: 'Riz Parfumé', price_xof: 8000, stock_qty: 0 });
    // Org B creates 1 product
    await request(app).post('/api/products').set('Cookie', [wholesalerBCookie])
      .send({ ...validProduct, sku: 'SPICE-001', name: 'Poivre Noir', price_xof: 3000, stock_qty: 500 });
  });

  it('retourne une réponse paginée avec data + total + page + limit', async () => {
    const res = await request(app).get('/api/products/browse').set('Cookie', [buyerCookie]);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total', 3);
    expect(res.body).toHaveProperty('page', 1);
    expect(res.body).toHaveProperty('limit');
    expect(res.body.data).toHaveLength(3);
  });

  it('chaque produit contient org_name (nom de l\'organisation)', async () => {
    const res = await request(app).get('/api/products/browse').set('Cookie', [buyerCookie]);
    expect(res.status).toBe(200);
    for (const p of res.body.data as Array<{ org_name: unknown }>) {
      expect(typeof p.org_name).toBe('string');
    }
    const names = (res.body.data as Array<{ org_name: string }>).map((p) => p.org_name);
    expect(names).toContain('Org A');
    expect(names).toContain('Org B');
  });

  it('filtre textuel q=Tissu retourne uniquement Tissu Wax', async () => {
    const res = await request(app).get('/api/products/browse?q=Tissu').set('Cookie', [buyerCookie]);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Tissu Wax');
    expect(res.body.total).toBe(1);
  });

  it('filtre q=WAX via SKU retourne Tissu Wax', async () => {
    const res = await request(app).get('/api/products/browse?q=WAX').set('Cookie', [buyerCookie]);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('filtre min_price=10000 retourne seulement Tissu Wax (15000)', async () => {
    const res = await request(app).get('/api/products/browse?min_price=10000').set('Cookie', [buyerCookie]);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Tissu Wax');
  });

  it('filtre max_price=5000 retourne seulement Poivre Noir (3000)', async () => {
    const res = await request(app).get('/api/products/browse?max_price=5000').set('Cookie', [buyerCookie]);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Poivre Noir');
  });

  it('filtre in_stock=true exclut les produits épuisés', async () => {
    const res = await request(app).get('/api/products/browse?in_stock=true').set('Cookie', [buyerCookie]);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2); // Tissu Wax + Poivre Noir
    const names = (res.body.data as Array<{ name: string }>).map((p) => p.name);
    expect(names).not.toContain('Riz Parfumé');
  });

  it('filtre org_id retourne uniquement les produits de l\'org cible', async () => {
    const res = await request(app).get(`/api/products/browse?org_id=${orgBId}`).set('Cookie', [buyerCookie]);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Poivre Noir');
  });

  it('filtre category=epices retourne uniquement les produits de cette catégorie', async () => {
    // Les 3 produits du beforeEach n'ont pas de catégorie → défaut 'autre'.
    await request(app).post('/api/products').set('Cookie', [wholesalerBCookie])
      .send({ ...validProduct, sku: 'CUR-001', name: 'Curcuma', price_xof: 4000, stock_qty: 10, category: 'epices' });

    const res = await request(app).get('/api/products/browse?category=epices').set('Cookie', [buyerCookie]);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    const names = (res.body.data as Array<{ name: string }>).map((p) => p.name);
    expect(names).toContain('Curcuma');
    expect(names).not.toContain('Tissu Wax'); // catégorie 'autre'
  });

  it('chaque produit expose sa catégorie (string) dans le browse', async () => {
    const res = await request(app).get('/api/products/browse').set('Cookie', [buyerCookie]);
    expect(res.status).toBe(200);
    for (const p of res.body.data as Array<{ category: unknown }>) {
      expect(typeof p.category).toBe('string');
    }
  });

  it('tri sort=price_asc classe du moins cher au plus cher', async () => {
    const res = await request(app).get('/api/products/browse?sort=price_asc').set('Cookie', [buyerCookie]);
    expect(res.status).toBe(200);
    const prices = (res.body.data as Array<{ price_xof: string }>).map((p) => Number(p.price_xof));
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it('tri sort=price_desc classe du plus cher au moins cher', async () => {
    const res = await request(app).get('/api/products/browse?sort=price_desc').set('Cookie', [buyerCookie]);
    expect(res.status).toBe(200);
    const prices = (res.body.data as Array<{ price_xof: string }>).map((p) => Number(p.price_xof));
    expect(prices).toEqual([...prices].sort((a, b) => b - a));
  });

  it('pagination limit=2 retourne 2 produits et total=3', async () => {
    const res = await request(app).get('/api/products/browse?limit=2&page=1').set('Cookie', [buyerCookie]);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(3);
    expect(res.body.page).toBe(1);
  });

  it('pagination page=2 limit=2 retourne le 3e produit', async () => {
    const res = await request(app).get('/api/products/browse?limit=2&page=2').set('Cookie', [buyerCookie]);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.page).toBe(2);
  });
});

describe('UC-10: buyer views product detail', () => {
  it('buyer can view any product detail by id', async () => {
    const createRes = await request(app)
      .post('/api/products')
      .set('Cookie', [wholesalerACookie])
      .send(validProduct);

    const res = await request(app)
      .get(`/api/products/${createRes.body.id}`)
      .set('Cookie', [buyerCookie]);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe(validProduct.name);
    expect(res.body.id).toBe(createRes.body.id);
    // Le détail public expose le nom du grossiste (org_name), pas un UUID.
    expect(typeof res.body.org_name).toBe('string');
  });

  it('returns 404 for non-existent product', async () => {
    const res = await request(app)
      .get('/api/products/00000000-0000-0000-0000-000000000000')
      .set('Cookie', [buyerCookie]);

    expect(res.status).toBe(404);
  });
});
