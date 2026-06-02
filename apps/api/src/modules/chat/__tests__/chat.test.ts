import request from 'supertest';
import { setupTestDb, teardownTestDb, cleanTables, getTestDb } from '../../auth/__tests__/setup.js';
import { createChatTestApp } from './test-app.js';
import bcrypt from 'bcrypt';

process.env.JWT_ACCESS_SECRET = 'test_access_secret_min_32_chars_xxxxxxxxxxxxx';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_min_32_chars_xxxxxxxxxxxx';
process.env.JWT_ACCESS_TTL_SEC = '900';
process.env.JWT_REFRESH_TTL_SEC = '604800';
process.env.COOKIE_SECURE = 'false';
process.env.NODE_ENV = 'test';

const app = createChatTestApp();

let orgAId: string;
let orgBId: string;
let buyerCookie: string;
let buyer2Cookie: string;
let wholesalerACookie: string;
let wholesalerBCookie: string;
let buyerId: string;

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanTables();
  const db = getTestDb();

  const [orgA] = await db('organizations').insert({ name: 'Tissus Aya', type: 'wholesaler', status: 'active' }).returning('id');
  const [orgB] = await db('organizations').insert({ name: 'Épices Marché', type: 'wholesaler', status: 'active' }).returning('id');
  orgAId = orgA!.id;
  orgBId = orgB!.id;

  const hash = await bcrypt.hash('TestPass123!', 12);

  const [buyer] = await db('users').insert({
    email: 'buyer@test.com', password_hash: hash, role: 'buyer',
    organization_id: null, first_name: 'Kouadio', last_name: 'Yao', phone: '+2250701010101', email_verified_at: new Date(),
  }).returning('id');
  buyerId = buyer!.id;

  await db('users').insert({
    email: 'buyer2@test.com', password_hash: hash, role: 'buyer',
    organization_id: null, first_name: 'Ama', last_name: 'Seck', phone: '+2250701010102', email_verified_at: new Date(),
  });
  await db('users').insert({
    email: 'admin-a@test.com', password_hash: hash, role: 'wholesaler_admin',
    organization_id: orgAId, first_name: 'Aya', last_name: 'Koné', phone: '+2250701010103', email_verified_at: new Date(),
  });
  await db('users').insert({
    email: 'admin-b@test.com', password_hash: hash, role: 'wholesaler_admin',
    organization_id: orgBId, first_name: 'Moussa', last_name: 'Diallo', phone: '+2250701010104', email_verified_at: new Date(),
  });

  const loginBuyer = await request(app).post('/api/auth/login').send({ email: 'buyer@test.com', password: 'TestPass123!' });
  const loginBuyer2 = await request(app).post('/api/auth/login').send({ email: 'buyer2@test.com', password: 'TestPass123!' });
  const loginA = await request(app).post('/api/auth/login').send({ email: 'admin-a@test.com', password: 'TestPass123!' });
  const loginB = await request(app).post('/api/auth/login').send({ email: 'admin-b@test.com', password: 'TestPass123!' });

  buyerCookie = (loginBuyer.headers['set-cookie'] as string[]).find((c: string) => c.startsWith('access_token='))!.split(';')[0]!;
  buyer2Cookie = (loginBuyer2.headers['set-cookie'] as string[]).find((c: string) => c.startsWith('access_token='))!.split(';')[0]!;
  wholesalerACookie = (loginA.headers['set-cookie'] as string[]).find((c: string) => c.startsWith('access_token='))!.split(';')[0]!;
  wholesalerBCookie = (loginB.headers['set-cookie'] as string[]).find((c: string) => c.startsWith('access_token='))!.split(';')[0]!;
});

/* ── Helpers ─────────────────────────────────────────── */

async function createConv(): Promise<string> {
  const res = await request(app)
    .post('/api/chat/conversations')
    .set('Cookie', [buyerCookie])
    .send({ wholesaler_org_id: orgAId });
  return res.body.id as string;
}

/* ── Tests ───────────────────────────────────────────── */

describe('UC-F7: Chat Acheteur ↔ Vendeur', () => {

  describe('GET /api/chat/orgs — liste les grossistes', () => {
    it('retourne les orgs actives pour le buyer', async () => {
      const res = await request(app).get('/api/chat/orgs').set('Cookie', [buyerCookie]);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
      const names = (res.body as Array<{ name: string }>).map((o) => o.name);
      expect(names).toContain('Tissus Aya');
      expect(names).toContain('Épices Marché');
    });

    it('404 pour un wholesaler (pas buyer) — §14 masque la ressource', async () => {
      const res = await request(app).get('/api/chat/orgs').set('Cookie', [wholesalerACookie]);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/chat/conversations — créer une conversation', () => {
    it('le buyer crée une conversation avec une org active', async () => {
      const res = await request(app)
        .post('/api/chat/conversations')
        .set('Cookie', [buyerCookie])
        .send({ wholesaler_org_id: orgAId });
      expect(res.status).toBe(201);
      expect(res.body.buyer_user_id).toBe(buyerId);
      expect(res.body.wholesaler_org_id).toBe(orgAId);
    });

    it('idempotent — retourne la même conversation si elle existe déjà', async () => {
      const r1 = await request(app)
        .post('/api/chat/conversations').set('Cookie', [buyerCookie]).send({ wholesaler_org_id: orgAId });
      const r2 = await request(app)
        .post('/api/chat/conversations').set('Cookie', [buyerCookie]).send({ wholesaler_org_id: orgAId });
      expect(r1.body.id).toBe(r2.body.id);
    });

    it('404 si org inexistante', async () => {
      const res = await request(app)
        .post('/api/chat/conversations')
        .set('Cookie', [buyerCookie])
        .send({ wholesaler_org_id: '00000000-0000-0000-0000-000000000000' });
      expect(res.status).toBe(404);
    });

    it('404 si wholesaler tente de créer une conversation — §14', async () => {
      const res = await request(app)
        .post('/api/chat/conversations')
        .set('Cookie', [wholesalerACookie])
        .send({ wholesaler_org_id: orgBId });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/chat/conversations — inbox', () => {
    it('buyer voit ses conversations', async () => {
      await createConv();
      const res = await request(app).get('/api/chat/conversations').set('Cookie', [buyerCookie]);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].org_name).toBe('Tissus Aya');
    });

    it('wholesaler A voit les conversations de son org', async () => {
      await createConv();
      const res = await request(app).get('/api/chat/conversations').set('Cookie', [wholesalerACookie]);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it('isolation : wholesaler B ne voit pas les conversations de orgA', async () => {
      await createConv();
      const res = await request(app).get('/api/chat/conversations').set('Cookie', [wholesalerBCookie]);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });

    it('isolation : buyer2 ne voit pas les conversations de buyer1', async () => {
      await createConv();
      const res = await request(app).get('/api/chat/conversations').set('Cookie', [buyer2Cookie]);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });
  });

  describe('POST /api/chat/conversations/:id/messages — envoyer un message', () => {
    it('buyer envoie un message', async () => {
      const convId = await createConv();
      const res = await request(app)
        .post(`/api/chat/conversations/${convId}/messages`)
        .set('Cookie', [buyerCookie])
        .send({ body: 'Bonjour, avez-vous du wax ?' });
      expect(res.status).toBe(201);
      expect(res.body.body).toBe('Bonjour, avez-vous du wax ?');
      expect(res.body.sender_user_id).toBe(buyerId);
    });

    it('wholesaler répond dans la même conversation', async () => {
      const convId = await createConv();
      const res = await request(app)
        .post(`/api/chat/conversations/${convId}/messages`)
        .set('Cookie', [wholesalerACookie])
        .send({ body: 'Oui, nous en avons en stock.' });
      expect(res.status).toBe(201);
      expect(res.body.body).toBe('Oui, nous en avons en stock.');
    });

    it('422 si body vide', async () => {
      const convId = await createConv();
      const res = await request(app)
        .post(`/api/chat/conversations/${convId}/messages`)
        .set('Cookie', [buyerCookie])
        .send({ body: '' });
      expect(res.status).toBe(422);
    });

    it('isolation : wholesaler B ne peut pas envoyer dans la conv de orgA', async () => {
      const convId = await createConv();
      const res = await request(app)
        .post(`/api/chat/conversations/${convId}/messages`)
        .set('Cookie', [wholesalerBCookie])
        .send({ body: 'Intrusion' });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/chat/conversations/:id/messages — lire les messages (paginés)', () => {
    it('retourne la liste paginée des messages avec total + page + limit', async () => {
      const convId = await createConv();
      await request(app)
        .post(`/api/chat/conversations/${convId}/messages`)
        .set('Cookie', [buyerCookie]).send({ body: 'Message 1' });
      await request(app)
        .post(`/api/chat/conversations/${convId}/messages`)
        .set('Cookie', [wholesalerACookie]).send({ body: 'Réponse 1' });

      const res = await request(app)
        .get(`/api/chat/conversations/${convId}/messages`)
        .set('Cookie', [buyerCookie]);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total', 2);
      expect(res.body).toHaveProperty('page', 1);
      expect(res.body.data).toHaveLength(2);
    });

    it('pagination limit=1 retourne 1 message sur 2', async () => {
      const convId = await createConv();
      await request(app)
        .post(`/api/chat/conversations/${convId}/messages`)
        .set('Cookie', [buyerCookie]).send({ body: 'M1' });
      await request(app)
        .post(`/api/chat/conversations/${convId}/messages`)
        .set('Cookie', [buyerCookie]).send({ body: 'M2' });

      const res = await request(app)
        .get(`/api/chat/conversations/${convId}/messages?limit=1&page=1`)
        .set('Cookie', [buyerCookie]);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(2);
    });

    it('isolation : buyer2 ne peut pas lire la conversation de buyer1', async () => {
      const convId = await createConv();
      const res = await request(app)
        .get(`/api/chat/conversations/${convId}/messages`)
        .set('Cookie', [buyer2Cookie]);
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/chat/conversations/:id/read — marquer comme lu', () => {
    it('marque les messages du wholesaler comme lus pour le buyer', async () => {
      const convId = await createConv();
      await request(app)
        .post(`/api/chat/conversations/${convId}/messages`)
        .set('Cookie', [wholesalerACookie]).send({ body: 'Message non lu' });

      await request(app)
        .patch(`/api/chat/conversations/${convId}/read`)
        .set('Cookie', [buyerCookie]);

      // Après mark read, unread_count = 0 dans l'inbox
      const inbox = await request(app).get('/api/chat/conversations').set('Cookie', [buyerCookie]);
      expect(inbox.body[0].unread_count).toBe('0');
    });

    it('404 si buyer tente de lire une conv qui ne lui appartient pas', async () => {
      const convId = await createConv();
      const res = await request(app)
        .patch(`/api/chat/conversations/${convId}/read`)
        .set('Cookie', [buyer2Cookie]);
      expect(res.status).toBe(404);
    });
  });
});
