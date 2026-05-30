import request from 'supertest';
import bcrypt from 'bcrypt';
import { setupTestDb, teardownTestDb, cleanTables, getTestDb } from '../../auth/__tests__/setup.js';
import { createAssistantTestApp, assistantMockCreate } from './test-app.js';

process.env.JWT_ACCESS_SECRET = 'test_access_secret_min_32_chars_xxxxxxxxxxxxx';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_min_32_chars_xxxxxxxxxxxx';
process.env.JWT_ACCESS_TTL_SEC = '900';
process.env.JWT_REFRESH_TTL_SEC = '604800';
process.env.COOKIE_SECURE = 'false';
process.env.NODE_ENV = 'test';

const app = createAssistantTestApp();

/* ── Helpers de réponse mock Anthropic ───────────────────── */

function textResponse(text: string) {
  return { stop_reason: 'end_turn', content: [{ type: 'text', text }] };
}

function toolUseResponse(name: string, input: unknown, id = 'tu_1') {
  return { stop_reason: 'tool_use', content: [{ type: 'tool_use', id, name, input }] };
}

/* ── Fixtures ────────────────────────────────────────────── */

let buyerACookie: string;
let buyerBCookie: string;
let wholesalerCookie: string;
let orderBId: string;

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanTables();
  assistantMockCreate.mockReset();
  const db = getTestDb();

  const [org] = await db('organizations').insert({ name: 'Org A', type: 'wholesaler', status: 'active' }).returning('id');
  const orgId = org!.id;

  const hash = await bcrypt.hash('TestPass123!', 12);

  await db('users').insert({
    email: 'admin@test.com', password_hash: hash, role: 'wholesaler_admin',
    organization_id: orgId, first_name: 'Admin', last_name: 'A',
  });
  const [buyerA] = await db('users').insert({
    email: 'buyer-a@test.com', password_hash: hash, role: 'buyer',
    organization_id: null, first_name: 'Buyer', last_name: 'A',
  }).returning('id');
  const [buyerB] = await db('users').insert({
    email: 'buyer-b@test.com', password_hash: hash, role: 'buyer',
    organization_id: null, first_name: 'Buyer', last_name: 'B',
  }).returning('id');

  // Commande appartenant à l'acheteur B (montant distinctif pour détecter une fuite).
  const [order] = await db('orders').insert({
    wholesaler_org_id: orgId,
    buyer_user_id: buyerB!.id,
    status: 'pending',
    total_xof: 999999,
    created_by: buyerB!.id,
  }).returning('id');
  orderBId = order!.id;

  const loginAdmin = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'TestPass123!' });
  wholesalerCookie = (loginAdmin.headers['set-cookie'] as string[]).find((c) => c.startsWith('access_token='))!.split(';')[0]!;

  const loginA = await request(app).post('/api/auth/login').send({ email: 'buyer-a@test.com', password: 'TestPass123!' });
  buyerACookie = (loginA.headers['set-cookie'] as string[]).find((c) => c.startsWith('access_token='))!.split(';')[0]!;

  const loginB = await request(app).post('/api/auth/login').send({ email: 'buyer-b@test.com', password: 'TestPass123!' });
  buyerBCookie = (loginB.headers['set-cookie'] as string[]).find((c) => c.startsWith('access_token='))!.split(';')[0]!;
});

/* ── Tests ───────────────────────────────────────────────── */

describe('Assistant IA — POST /api/assistant/chat', () => {
  it('rejette une requête non authentifiée (401)', async () => {
    const res = await request(app).post('/api/assistant/chat').send({ message: 'Bonjour' });
    expect(res.status).toBe(401);
    expect(assistantMockCreate).not.toHaveBeenCalled();
  });

  it('rejette un grossiste — réservé aux acheteurs (404, §14 anti info-leak)', async () => {
    const res = await request(app)
      .post('/api/assistant/chat')
      .set('Cookie', wholesalerCookie)
      .send({ message: 'Bonjour' });
    expect(res.status).toBe(404);
    expect(assistantMockCreate).not.toHaveBeenCalled();
  });

  it('rejette un payload invalide (422)', async () => {
    const res = await request(app)
      .post('/api/assistant/chat')
      .set('Cookie', buyerACookie)
      .send({ message: '' });
    expect(res.status).toBe(422);
  });

  it('répond avec le texte du modèle (happy path, sans outil)', async () => {
    assistantMockCreate.mockResolvedValueOnce(textResponse('Bonjour, comment puis-je vous aider ?'));

    const res = await request(app)
      .post('/api/assistant/chat')
      .set('Cookie', buyerACookie)
      .send({ message: 'Salut' });

    expect(res.status).toBe(200);
    expect(res.body.reply).toContain('aider');
    expect(assistantMockCreate).toHaveBeenCalledTimes(1);
  });

  it('UC-14: isolation cross-tenant — un acheteur ne peut pas lire la commande d\'un autre via un outil', async () => {
    // 1er appel : le modèle demande le statut de la commande de l'acheteur B.
    assistantMockCreate.mockResolvedValueOnce(toolUseResponse('statut_commande', { order_id: orderBId }));
    // 2e appel : le modèle conclut après le résultat de l'outil.
    assistantMockCreate.mockResolvedValueOnce(textResponse('Je ne trouve pas cette commande.'));

    const res = await request(app)
      .post('/api/assistant/chat')
      .set('Cookie', buyerACookie) // authentifié en tant qu'acheteur A
      .send({ message: 'Quel est le statut de la commande ?' });

    expect(res.status).toBe(200);
    expect(assistantMockCreate).toHaveBeenCalledTimes(2);

    // Le résultat d'outil renvoyé au modèle ne doit PAS contenir les données de B.
    const secondCallMessages = assistantMockCreate.mock.calls[1]![0].messages as Array<{ role: string; content: unknown }>;
    const toolResultMsg = secondCallMessages.find((m) => m.role === 'user' && Array.isArray(m.content));
    const serialized = JSON.stringify(toolResultMsg);
    expect(serialized).not.toContain('999999'); // montant de la commande de B
    expect(serialized.toLowerCase()).toContain('introuvable');
  });

  it('le propre acheteur peut lire le statut de sa commande', async () => {
    assistantMockCreate.mockResolvedValueOnce(toolUseResponse('statut_commande', { order_id: orderBId }));
    assistantMockCreate.mockResolvedValueOnce(textResponse('Votre commande est en attente.'));

    const res = await request(app)
      .post('/api/assistant/chat')
      .set('Cookie', buyerBCookie) // l'acheteur B lit SA commande
      .send({ message: 'Statut de ma commande ?' });

    expect(res.status).toBe(200);
    const secondCallMessages = assistantMockCreate.mock.calls[1]![0].messages as Array<{ role: string; content: unknown }>;
    const serialized = JSON.stringify(secondCallMessages);
    expect(serialized).toContain('999999'); // B voit bien son propre montant
  });
});
