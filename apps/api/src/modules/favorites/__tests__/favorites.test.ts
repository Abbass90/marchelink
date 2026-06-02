import request from 'supertest';
import { setupTestDb, teardownTestDb, cleanTables, getTestDb } from '../../auth/__tests__/setup.js';
import { createFavoritesTestApp } from './test-app.js';
import bcrypt from 'bcrypt';

process.env.JWT_ACCESS_SECRET = 'test_access_secret_min_32_chars_xxxxxxxxxxxxx';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_min_32_chars_xxxxxxxxxxxx';
process.env.JWT_ACCESS_TTL_SEC = '900';
process.env.JWT_REFRESH_TTL_SEC = '604800';
process.env.COOKIE_SECURE = 'false';
process.env.NODE_ENV = 'test';

const app = createFavoritesTestApp();

let buyerCookie: string;
let productId: string;
let productIdB: string;

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanTables();
  const db = getTestDb();

  const [org] = await db('organizations')
    .insert({ name: 'Grossiste Test', type: 'wholesaler', status: 'active' })
    .returning('id') as [{ id: string }];

  const hash = await bcrypt.hash('TestPass123!', 12);

  // Buyer
  await db('users').insert({
    email: 'buyer@test.com',
    password_hash: hash,
    role: 'buyer',
    first_name: 'Kouadio',
    last_name: 'Test',
    phone: '+2250701010101',
    email_verified_at: new Date(),
  });

  // Two products in the wholesaler's catalog
  const [pA] = await db('products').insert({
    organization_id: org.id,
    sku: 'WAX-001',
    name: 'Tissu Wax Hollandais',
    price_xof: 15000,
    stock_qty: 100,
    unit: 'pagne',
    category: 'tissus',
  }).returning('id') as [{ id: string }];

  const [pB] = await db('products').insert({
    organization_id: org.id,
    sku: 'POI-001',
    name: 'Poivre Noir 1kg',
    price_xof: 3000,
    stock_qty: 50,
    unit: 'kg',
    category: 'epices',
  }).returning('id') as [{ id: string }];

  productId = pA.id;
  productIdB = pB.id;

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'buyer@test.com', password: 'TestPass123!' });
  buyerCookie = loginRes.headers['set-cookie']?.[0] as string;
});

describe('UC-F1: acheteur gère ses favoris', () => {
  describe('GET /api/favorites', () => {
    it('retourne une liste vide quand aucun favori', async () => {
      const res = await request(app)
        .get('/api/favorites')
        .set('Cookie', buyerCookie);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('retourne les favoris avec les données produit joinées', async () => {
      // Add a favorite first via the DB
      const db = getTestDb();
      const [buyer] = await db('users').where({ email: 'buyer@test.com' }).select('id') as [{ id: string }];
      await db('favorites').insert({ buyer_user_id: buyer.id, product_id: productId });

      const res = await request(app)
        .get('/api/favorites')
        .set('Cookie', buyerCookie);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].product_id).toBe(productId);
      expect(res.body[0].product_name).toBe('Tissu Wax Hollandais');
      expect(res.body[0].product_category).toBe('tissus');
      expect(res.body[0].org_name).toBe('Grossiste Test');
    });
  });

  describe('POST /api/favorites/:productId', () => {
    it('ajoute un produit aux favoris (200 + id)', async () => {
      const res = await request(app)
        .post(`/api/favorites/${productId}`)
        .set('Cookie', buyerCookie);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id');
    });

    it('est idempotent : double appel ne duplique pas', async () => {
      await request(app)
        .post(`/api/favorites/${productId}`)
        .set('Cookie', buyerCookie);
      const res2 = await request(app)
        .post(`/api/favorites/${productId}`)
        .set('Cookie', buyerCookie);
      expect(res2.status).toBe(200);

      const db = getTestDb();
      const count = await db('favorites')
        .where({ product_id: productId })
        .whereNull('deleted_at')
        .count('id as n')
        .first() as { n: string };
      expect(Number(count.n)).toBe(1);
    });

    it('retourne 404 pour un produit inexistant', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .post(`/api/favorites/${fakeId}`)
        .set('Cookie', buyerCookie);
      expect(res.status).toBe(404);
    });

    it('retourne 404 si l\'acheteur utilise l\'endpoint avec le rôle wholesaler', async () => {
      // Wholesaler should get 404 (role mismatch masked as 404 per CLAUDE.md §14)
      await getTestDb()('users').insert({
        email: 'ws@test.com',
        password_hash: await bcrypt.hash('TestPass123!', 12),
        role: 'wholesaler_admin',
        organization_id: (await getTestDb()('organizations').first())!.id,
        first_name: 'WS',
        last_name: 'Test',
        phone: '+2250701010200',
        email_verified_at: new Date(),
      });
      const wsLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: 'ws@test.com', password: 'TestPass123!' });
      const wsCookie = wsLogin.headers['set-cookie']?.[0] as string;
      const res = await request(app)
        .post(`/api/favorites/${productId}`)
        .set('Cookie', wsCookie);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/favorites/:productId', () => {
    it('retire un produit des favoris (204)', async () => {
      await request(app)
        .post(`/api/favorites/${productId}`)
        .set('Cookie', buyerCookie);
      const res = await request(app)
        .delete(`/api/favorites/${productId}`)
        .set('Cookie', buyerCookie);
      expect(res.status).toBe(204);

      const listRes = await request(app)
        .get('/api/favorites')
        .set('Cookie', buyerCookie);
      expect(listRes.body).toHaveLength(0);
    });

    it('retourne 404 si le produit n\'est pas dans les favoris', async () => {
      const res = await request(app)
        .delete(`/api/favorites/${productId}`)
        .set('Cookie', buyerCookie);
      expect(res.status).toBe(404);
    });

    it('l\'acheteur A ne peut pas supprimer les favoris de l\'acheteur B (isolation)', async () => {
      // Create a second buyer and their favorite
      const db = getTestDb();
      await db('users').insert({
        email: 'buyer2@test.com',
        password_hash: await bcrypt.hash('TestPass123!', 12),
        role: 'buyer',
        first_name: 'Amani',
        last_name: 'Test',
        phone: '+2250701010199',
        email_verified_at: new Date(),
      });
      const buyer2Login = await request(app)
        .post('/api/auth/login')
        .send({ email: 'buyer2@test.com', password: 'TestPass123!' });
      const buyer2Cookie = buyer2Login.headers['set-cookie']?.[0] as string;

      // Buyer2 favorites productId
      await request(app)
        .post(`/api/favorites/${productId}`)
        .set('Cookie', buyer2Cookie);

      // Buyer1 tries to delete buyer2's favorite — gets 404 (no such favorite for buyer1)
      const res = await request(app)
        .delete(`/api/favorites/${productId}`)
        .set('Cookie', buyerCookie);
      expect(res.status).toBe(404);
    });
  });

  describe('Flux complet re-commande', () => {
    it('ajoute 2 produits, liste, retire 1, re-liste', async () => {
      await request(app)
        .post(`/api/favorites/${productId}`)
        .set('Cookie', buyerCookie);
      await request(app)
        .post(`/api/favorites/${productIdB}`)
        .set('Cookie', buyerCookie);

      const listRes = await request(app)
        .get('/api/favorites')
        .set('Cookie', buyerCookie);
      expect(listRes.body).toHaveLength(2);

      await request(app)
        .delete(`/api/favorites/${productId}`)
        .set('Cookie', buyerCookie);

      const listRes2 = await request(app)
        .get('/api/favorites')
        .set('Cookie', buyerCookie);
      expect(listRes2.body).toHaveLength(1);
      expect(listRes2.body[0].product_id).toBe(productIdB);
    });
  });
});
