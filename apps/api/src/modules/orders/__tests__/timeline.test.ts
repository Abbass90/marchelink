/**
 * F3: Suivi Commande — Timeline visuelle
 * Cycle complet : pending → accepted → paid → shipped → delivered
 * Vérifie l'insertion chronologique des events et l'isolation cross-tenant (UC-14)
 */

import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { Router } from 'express';
import bcrypt from 'bcrypt';
import { correlationId } from '../../../middleware/correlation-id.middleware.js';
import { errorHandler } from '../../../middleware/error-handler.middleware.js';
import { requireAuth } from '../../../middleware/auth.middleware.js';
import { requireRole } from '../../../middleware/role.middleware.js';
import { AuthController } from '../../auth/auth.controller.js';
import { AuthService } from '../../auth/auth.service.js';
import { AuthRepository } from '../../auth/auth.repository.js';
import { ProductController } from '../../products/product.controller.js';
import { ProductService } from '../../products/product.service.js';
import { ProductRepository } from '../../products/product.repository.js';
import { OrderController } from '../order.controller.js';
import { OrderService } from '../order.service.js';
import { OrderRepository } from '../order.repository.js';
import { OrderEventRepository } from '../order-event.repository.js';
import { PaymentController } from '../../payments/payment.controller.js';
import { PaymentService } from '../../payments/payment.service.js';
import { PaymentRepository } from '../../payments/payment.repository.js';
import { setupTestDb, teardownTestDb, cleanTables, getTestDb } from '../../auth/__tests__/setup.js';

/* ── Env ────────────────────────────────────────────────────── */
process.env.JWT_ACCESS_SECRET  = 'test_access_secret_min_32_chars_xxxxxxxxxxxxx';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_min_32_chars_xxxxxxxxxxxx';
process.env.JWT_ACCESS_TTL_SEC  = '900';
process.env.JWT_REFRESH_TTL_SEC = '604800';
process.env.COOKIE_SECURE = 'false';
process.env.NODE_ENV = 'test';

/* ── App factory ────────────────────────────────────────────── */
function createTimelineTestApp() {
  const db = getTestDb();

  const authRepo    = new AuthRepository(db);
  const authService = new AuthService(authRepo);
  const authCtrl    = new AuthController(authService);

  const productRepo    = new ProductRepository(db);
  const productService = new ProductService(productRepo);
  const productCtrl    = new ProductController(productService);

  const eventRepo   = new OrderEventRepository(db);
  const orderRepo   = new OrderRepository(db);
  const orderService = new OrderService(orderRepo, db, eventRepo);
  const orderCtrl   = new OrderController(orderService);

  const paymentRepo    = new PaymentRepository(db);
  const paymentService = new PaymentService(paymentRepo, eventRepo);
  const paymentCtrl    = new PaymentController(paymentService);

  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(correlationId());

  const authRouter = Router();
  authRouter.post('/register', authCtrl.register);
  authRouter.post('/login', authCtrl.login);
  app.use('/api/auth', authRouter);

  const prodRouter = Router();
  prodRouter.post('/', requireAuth, requireRole('wholesaler_admin', 'wholesaler_seller'), productCtrl.create);
  app.use('/api/products', prodRouter);

  const orderRouter = Router();
  orderRouter.post('/', requireAuth, requireRole('buyer'), orderCtrl.placeOrder);
  orderRouter.get('/my/:id', requireAuth, requireRole('buyer'), orderCtrl.getByIdForBuyer);
  orderRouter.get('/my/:id/timeline', requireAuth, requireRole('buyer'), orderCtrl.getTimelineForBuyer);
  orderRouter.patch('/my/:id/cancel', requireAuth, requireRole('buyer'), orderCtrl.cancelOrder);
  app.use('/api/orders', orderRouter);

  // Wholesaler sub-router (must come after /api/orders catch-all)
  const orderOrgRouter = Router();
  orderOrgRouter.get('/:id', requireAuth, requireRole('wholesaler_admin', 'wholesaler_seller'), orderCtrl.getByIdForWholesaler);
  orderOrgRouter.get('/:id/timeline', requireAuth, requireRole('wholesaler_admin', 'wholesaler_seller'), orderCtrl.getTimelineForWholesaler);
  orderOrgRouter.patch('/:id/status', requireAuth, requireRole('wholesaler_admin', 'wholesaler_seller'), orderCtrl.updateStatus);
  app.use('/api/orders/org', orderOrgRouter);

  const payRouter = Router();
  payRouter.post('/initiate', requireAuth, requireRole('buyer'), paymentCtrl.initiate);
  payRouter.post('/webhook', paymentCtrl.webhook);
  app.use('/api/payments', payRouter);

  app.use(errorHandler);
  return app;
}

const app = createTimelineTestApp();

/* ── Fixtures ───────────────────────────────────────────────── */
let orgId: string;
let wholesalerCookie: string;
let buyerCookie: string;
let productId: string;

function cookieOf(res: request.Response): string {
  return (res.headers['set-cookie'] as string[])
    .find((c: string) => c.startsWith('access_token='))!
    .split(';')[0]!;
}

beforeAll(async () => { await setupTestDb(); });
afterAll(async ()  => { await teardownTestDb(); });

beforeEach(async () => {
  await cleanTables();
  const db = getTestDb();

  const [org] = await db('organizations')
    .insert({ name: 'Adjamé Textile', type: 'wholesaler', status: 'active' })
    .returning('id');
  orgId = org!.id;

  const hash = await bcrypt.hash('Test1234!', 12);

  await db('users').insert([
    { email: 'wholesaler@test.ci', password_hash: hash, role: 'wholesaler_admin', organization_id: orgId, first_name: 'Admin', last_name: 'W' },
    { email: 'buyer@test.ci',      password_hash: hash, role: 'buyer',            organization_id: null,  first_name: 'Kouadio', last_name: 'B' },
  ]);

  const loginW = await request(app).post('/api/auth/login').send({ email: 'wholesaler@test.ci', password: 'Test1234!' });
  wholesalerCookie = cookieOf(loginW);

  const loginB = await request(app).post('/api/auth/login').send({ email: 'buyer@test.ci', password: 'Test1234!' });
  buyerCookie = cookieOf(loginB);

  const prodRes = await request(app)
    .post('/api/products')
    .set('Cookie', [wholesalerCookie])
    .send({ sku: 'WAX-TL-01', name: 'Tissu Wax', description: 'Premium', price_xof: 5000, stock_qty: 100, unit: 'pièce' });
  productId = prodRes.body.id;
});

/* ── Tests ──────────────────────────────────────────────────── */

describe('F3: Suivi Commande — Timeline visuelle', () => {
  describe('UC-17: timeline buyer — cycle complet', () => {
    it('retourne 5 events dans l\'ordre chronologique après le cycle complet', async () => {
      // 1 — Place order (→ pending)
      const orderRes = await request(app)
        .post('/api/orders')
        .set('Cookie', [buyerCookie])
        .send({ wholesaler_org_id: orgId, items: [{ product_id: productId, quantity: 2 }] });
      expect(orderRes.status).toBe(201);
      const orderId: string = orderRes.body.id;

      // 2 — Wholesaler accepts (→ accepted)
      await request(app)
        .patch(`/api/orders/org/${orderId}/status`)
        .set('Cookie', [wholesalerCookie])
        .send({ status: 'accepted' });

      // 3 — Initiate + webhook completed (→ paid)
      const initRes = await request(app)
        .post('/api/payments/initiate')
        .set('Cookie', [buyerCookie])
        .send({ order_id: orderId, phone_number: '+2250700000001' });
      expect(initRes.status).toBe(201);
      const idem: string = initRes.body.idempotency_key;

      await request(app)
        .post('/api/payments/webhook')
        .send({ idempotency_key: idem, status: 'completed', provider_ref: 'CINETPAY_ABC123' });

      // 4 — Wholesaler ships (→ shipped)
      const shipRes = await request(app)
        .patch(`/api/orders/org/${orderId}/status`)
        .set('Cookie', [wholesalerCookie])
        .send({ status: 'shipped' });
      expect(shipRes.status).toBe(200);

      // 5 — Wholesaler marks delivered (→ delivered)
      await request(app)
        .patch(`/api/orders/org/${orderId}/status`)
        .set('Cookie', [wholesalerCookie])
        .send({ status: 'delivered' });

      // Assert timeline
      const tlRes = await request(app)
        .get(`/api/orders/my/${orderId}/timeline`)
        .set('Cookie', [buyerCookie]);

      expect(tlRes.status).toBe(200);
      const events: Array<{ status: string; created_at: string }> = tlRes.body;
      expect(events).toHaveLength(5);

      const statuses = events.map((e) => e.status);
      expect(statuses).toEqual(['pending', 'accepted', 'paid', 'shipped', 'delivered']);

      // Ordre chronologique strict
      for (let i = 1; i < events.length; i++) {
        expect(new Date(events[i]!.created_at).getTime()).toBeGreaterThanOrEqual(
          new Date(events[i - 1]!.created_at).getTime(),
        );
      }
    });
  });

  describe('UC-17: timeline wholesaler — cycle complet', () => {
    it('retourne les mêmes events via l\'endpoint grossiste', async () => {
      const orderRes = await request(app)
        .post('/api/orders')
        .set('Cookie', [buyerCookie])
        .send({ wholesaler_org_id: orgId, items: [{ product_id: productId, quantity: 1 }] });
      const orderId: string = orderRes.body.id;

      await request(app)
        .patch(`/api/orders/org/${orderId}/status`)
        .set('Cookie', [wholesalerCookie])
        .send({ status: 'accepted' });

      const initRes = await request(app)
        .post('/api/payments/initiate')
        .set('Cookie', [buyerCookie])
        .send({ order_id: orderId, phone_number: '+2250700000001' });

      await request(app)
        .post('/api/payments/webhook')
        .send({ idempotency_key: initRes.body.idempotency_key, status: 'completed', provider_ref: 'CINETPAY_XYZ' });

      await request(app)
        .patch(`/api/orders/org/${orderId}/status`)
        .set('Cookie', [wholesalerCookie])
        .send({ status: 'shipped' });

      await request(app)
        .patch(`/api/orders/org/${orderId}/status`)
        .set('Cookie', [wholesalerCookie])
        .send({ status: 'delivered' });

      const tlRes = await request(app)
        .get(`/api/orders/org/${orderId}/timeline`)
        .set('Cookie', [wholesalerCookie]);

      expect(tlRes.status).toBe(200);
      const statuses = (tlRes.body as Array<{ status: string }>).map((e) => e.status);
      expect(statuses).toEqual(['pending', 'accepted', 'paid', 'shipped', 'delivered']);
    });
  });

  describe('UC-17: timeline avec annulation', () => {
    it('retourne 2 events (pending → cancelled) après annulation par l\'acheteur', async () => {
      const orderRes = await request(app)
        .post('/api/orders')
        .set('Cookie', [buyerCookie])
        .send({ wholesaler_org_id: orgId, items: [{ product_id: productId, quantity: 1 }] });
      const orderId: string = orderRes.body.id;

      await request(app)
        .patch(`/api/orders/my/${orderId}/cancel`)
        .set('Cookie', [buyerCookie]);

      const tlRes = await request(app)
        .get(`/api/orders/my/${orderId}/timeline`)
        .set('Cookie', [buyerCookie]);

      expect(tlRes.status).toBe(200);
      const statuses = (tlRes.body as Array<{ status: string }>).map((e) => e.status);
      expect(statuses).toEqual(['pending', 'cancelled']);
    });
  });

  describe('UC-17: timeline avec rejet grossiste', () => {
    it('retourne 2 events (pending → rejected) après rejet', async () => {
      const orderRes = await request(app)
        .post('/api/orders')
        .set('Cookie', [buyerCookie])
        .send({ wholesaler_org_id: orgId, items: [{ product_id: productId, quantity: 1 }] });
      const orderId: string = orderRes.body.id;

      await request(app)
        .patch(`/api/orders/org/${orderId}/status`)
        .set('Cookie', [wholesalerCookie])
        .send({ status: 'rejected' });

      const tlRes = await request(app)
        .get(`/api/orders/my/${orderId}/timeline`)
        .set('Cookie', [buyerCookie]);

      expect(tlRes.status).toBe(200);
      const statuses = (tlRes.body as Array<{ status: string }>).map((e) => e.status);
      expect(statuses).toEqual(['pending', 'rejected']);
    });
  });

  describe('UC-14: isolation cross-tenant timeline', () => {
    it('retourne 404 si le buyer accède à une commande qui ne lui appartient pas', async () => {
      // Créer un second acheteur
      const db = getTestDb();
      const hash = await bcrypt.hash('Test1234!', 12);
      await db('users').insert({
        email: 'buyer2@test.ci', password_hash: hash, role: 'buyer',
        organization_id: null, first_name: 'Other', last_name: 'Buyer',
      });
      const loginB2 = await request(app).post('/api/auth/login').send({ email: 'buyer2@test.ci', password: 'Test1234!' });
      const buyer2Cookie = cookieOf(loginB2);

      // Buyer 1 passe une commande
      const orderRes = await request(app)
        .post('/api/orders')
        .set('Cookie', [buyerCookie])
        .send({ wholesaler_org_id: orgId, items: [{ product_id: productId, quantity: 1 }] });
      const orderId: string = orderRes.body.id;

      // Buyer 2 tente d'accéder à la timeline → doit retourner 404
      const tlRes = await request(app)
        .get(`/api/orders/my/${orderId}/timeline`)
        .set('Cookie', [buyer2Cookie]);

      expect(tlRes.status).toBe(404);
    });

    it('retourne 404 si le grossiste accède à une commande d\'un autre tenant', async () => {
      // Créer une seconde org et un second grossiste
      const db = getTestDb();
      const [org2] = await db('organizations').insert({ name: 'Org B', type: 'wholesaler', status: 'active' }).returning('id');
      const hash = await bcrypt.hash('Test1234!', 12);
      await db('users').insert({
        email: 'wholesaler2@test.ci', password_hash: hash, role: 'wholesaler_admin',
        organization_id: org2!.id, first_name: 'Admin', last_name: 'B',
      });
      const loginW2 = await request(app).post('/api/auth/login').send({ email: 'wholesaler2@test.ci', password: 'Test1234!' });
      const wholesaler2Cookie = cookieOf(loginW2);

      // Buyer passe commande chez org 1
      const orderRes = await request(app)
        .post('/api/orders')
        .set('Cookie', [buyerCookie])
        .send({ wholesaler_org_id: orgId, items: [{ product_id: productId, quantity: 1 }] });
      const orderId: string = orderRes.body.id;

      // Grossiste org 2 tente d'accéder → 404
      const tlRes = await request(app)
        .get(`/api/orders/org/${orderId}/timeline`)
        .set('Cookie', [wholesaler2Cookie]);

      expect(tlRes.status).toBe(404);
    });
  });
});
