import type { Knex } from 'knex';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';

const BCRYPT_ROUNDS = 12;
const DEFAULT_PASSWORD = 'MarcheLink2026!';

export async function seed(knex: Knex): Promise<void> {
  /* ── Clean all tables (reverse FK order) ──────────── */
  await knex('messages').del();
  await knex('conversations').del();
  await knex('order_events').del();
  await knex('payments').del();
  await knex('order_items').del();
  await knex('orders').del();
  await knex('products').del();
  await knex('refresh_tokens').del();
  await knex('users').del();
  await knex('organizations').del();

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, BCRYPT_ROUNDS);

  /* ══════════════════════════════════════════════════════
     ORGANIZATIONS — 2 grossistes d'Adjamé
     ══════════════════════════════════════════════════════ */

  const orgTissusId = randomUUID();
  const orgEpicesId = randomUUID();

  await knex('organizations').insert([
    { id: orgTissusId, name: "Tissus d'Aya", type: 'wholesaler', status: 'active' },
    { id: orgEpicesId, name: 'Épices du Marché', type: 'wholesaler', status: 'active' },
  ]);

  /* ══════════════════════════════════════════════════════
     USERS — 4 comptes de test
     ══════════════════════════════════════════════════════ */

  const adminId = randomUUID();
  const ayaId = randomUUID();
  const moussaId = randomUUID();
  const kouadioId = randomUUID();

  await knex('users').insert([
    /* Platform admin */
    {
      id: adminId,
      email: 'admin@marchelink.ci',
      password_hash: passwordHash,
      role: 'platform_admin',
      organization_id: null,
      first_name: 'Admin',
      last_name: 'MarchéLink',
      email_verified_at: new Date(),
    },
    /* Grossiste 1 — Tissus d'Aya */
    {
      id: ayaId,
      email: 'aya@tissus.ci',
      password_hash: passwordHash,
      role: 'wholesaler_admin',
      organization_id: orgTissusId,
      first_name: 'Aya',
      last_name: 'Koné',
      phone: '+2250701000001',
      email_verified_at: new Date(),
    },
    /* Grossiste 2 — Épices du Marché */
    {
      id: moussaId,
      email: 'moussa@epices.ci',
      password_hash: passwordHash,
      role: 'wholesaler_admin',
      organization_id: orgEpicesId,
      first_name: 'Moussa',
      last_name: 'Diallo',
      phone: '+2250701000002',
      email_verified_at: new Date(),
    },
    /* Acheteur (boutiquier) */
    {
      id: kouadioId,
      email: 'kouadio@boutique.ci',
      password_hash: passwordHash,
      role: 'buyer',
      organization_id: null,
      first_name: 'Kouadio',
      last_name: 'Yao',
      phone: '+2250700000001',
      email_verified_at: new Date(),
    },
  ]);

  /* ══════════════════════════════════════════════════════
     PRODUCTS — 10 produits (5 par grossiste)
     ══════════════════════════════════════════════════════ */

  /* --- Tissus d'Aya --- */
  const pWax = randomUUID();
  const pBazin = randomUUID();
  const pKente = randomUUID();
  const pSoie = randomUUID();
  const pCoton = randomUUID();

  /* --- Épices du Marché --- */
  const pPoivre = randomUUID();
  const pGingembre = randomUUID();
  const pCurcuma = randomUUID();
  const pPiment = randomUUID();
  const pCannelle = randomUUID();

  await knex('products').insert([
    /* Tissus d'Aya */
    {
      id: pWax,
      organization_id: orgTissusId,
      sku: 'WAX-6YD',
      category: 'tissus',
      name: 'Wax Hollandais 6 yards',
      description: 'Tissu wax original hollandais, couleurs vives. Rouleau de 6 yards.',
      price_xof: 18500,
      stock_qty: 150,
      unit: 'rouleau',
      image_url: 'https://images.unsplash.com/photo-1590735213920-68192a487bc2?w=400',
      created_by: ayaId,
    },
    {
      id: pBazin,
      organization_id: orgTissusId,
      sku: 'BAZ-RICHE',
      category: 'tissus',
      name: 'Bazin Riche 10 mètres',
      description: 'Bazin riche importé du Mali, qualité premium pour les grandes occasions.',
      price_xof: 45000,
      stock_qty: 60,
      unit: 'pièce',
      image_url: 'https://images.unsplash.com/photo-1606722590583-6951b5ea92ad?w=400',
      created_by: ayaId,
    },
    {
      id: pKente,
      organization_id: orgTissusId,
      sku: 'KNT-STRIP',
      category: 'tissus',
      name: 'Kenté Ashanti Bande',
      description: 'Bande de kenté tissée à la main, motifs traditionnels Ashanti.',
      price_xof: 32000,
      stock_qty: 8,
      unit: 'bande',
      image_url: 'https://images.unsplash.com/photo-1594736797933-d0501ba2fe65?w=400',
      created_by: ayaId,
    },
    {
      id: pSoie,
      organization_id: orgTissusId,
      sku: 'SOIE-5M',
      category: 'tissus',
      name: 'Soie Naturelle 5 mètres',
      description: 'Soie naturelle importée, pour couture haute gamme.',
      price_xof: 75000,
      stock_qty: 3,
      unit: 'rouleau',
      created_by: ayaId,
    },
    {
      id: pCoton,
      organization_id: orgTissusId,
      sku: 'COT-UNI',
      category: 'tissus',
      name: 'Coton Uni 10 mètres',
      description: 'Coton blanc uni pour sous-vêtements et doublures. Bonne qualité.',
      price_xof: 5500,
      stock_qty: 300,
      unit: 'rouleau',
      image_url: 'https://images.unsplash.com/photo-1558171813-4c088753af8f?w=400',
      created_by: ayaId,
    },

    /* Épices du Marché */
    {
      id: pPoivre,
      organization_id: orgEpicesId,
      sku: 'POI-NOIR-1K',
      category: 'epices',
      name: 'Poivre Noir 1 kg',
      description: 'Poivre noir en grains du Cameroun, séché au soleil.',
      price_xof: 12000,
      stock_qty: 200,
      unit: 'kg',
      image_url: 'https://images.unsplash.com/photo-1599909533986-61bebc60bf70?w=400',
      created_by: moussaId,
    },
    {
      id: pGingembre,
      organization_id: orgEpicesId,
      sku: 'GIN-FRAIS',
      category: 'epices',
      name: 'Gingembre Frais 5 kg',
      description: 'Gingembre frais du marché, idéal pour jus et cuisine.',
      price_xof: 7500,
      stock_qty: 120,
      unit: 'sac',
      image_url: 'https://images.unsplash.com/photo-1615485500704-8e990f9900f7?w=400',
      created_by: moussaId,
    },
    {
      id: pCurcuma,
      organization_id: orgEpicesId,
      sku: 'CUR-POUDRE',
      category: 'epices',
      name: 'Curcuma en Poudre 500g',
      description: 'Curcuma moulu, provenance Inde. Utilisé en cuisine et médecine.',
      price_xof: 4500,
      stock_qty: 85,
      unit: 'sachet',
      created_by: moussaId,
    },
    {
      id: pPiment,
      organization_id: orgEpicesId,
      sku: 'PIM-HABANERO',
      category: 'epices',
      name: 'Piment Habanero Séché 200g',
      description: 'Piment habanero séché très fort, pour sauces piquantes.',
      price_xof: 3500,
      stock_qty: 5,
      unit: 'sachet',
      image_url: 'https://images.unsplash.com/photo-1583119022894-919a68a3d0e3?w=400',
      created_by: moussaId,
    },
    {
      id: pCannelle,
      organization_id: orgEpicesId,
      sku: 'CAN-BATON',
      category: 'epices',
      name: 'Cannelle en Bâtons 250g',
      description: 'Bâtons de cannelle de Ceylan. Pour thé, desserts et plats mijotés.',
      price_xof: 6000,
      stock_qty: 0,
      unit: 'paquet',
      created_by: moussaId,
    },
  ]);

  /* ══════════════════════════════════════════════════════
     ORDERS — 4 commandes à différents stades
     ══════════════════════════════════════════════════════ */

  const order1Id = randomUUID(); // pending  — chez Tissus
  const order2Id = randomUUID(); // paid     — chez Tissus (prête à être expédiée)
  const order3Id = randomUUID(); // delivered— chez Épices
  const order4Id = randomUUID(); // accepted — chez Épices (en attente paiement)
  const order5Id = randomUUID(); // shipped  — chez Tissus (expédiée par le grossiste)

  await knex('orders').insert([
    {
      id: order1Id,
      wholesaler_org_id: orgTissusId,
      buyer_user_id: kouadioId,
      status: 'pending',
      total_xof: 63500,
      created_by: kouadioId,
    },
    {
      id: order2Id,
      wholesaler_org_id: orgTissusId,
      buyer_user_id: kouadioId,
      status: 'paid',
      total_xof: 45000,
      created_by: kouadioId,
    },
    {
      id: order3Id,
      wholesaler_org_id: orgEpicesId,
      buyer_user_id: kouadioId,
      status: 'delivered',
      total_xof: 31500,
      created_by: kouadioId,
    },
    {
      id: order4Id,
      wholesaler_org_id: orgEpicesId,
      buyer_user_id: kouadioId,
      status: 'accepted',
      total_xof: 24000,
      created_by: kouadioId,
    },
    {
      id: order5Id,
      wholesaler_org_id: orgTissusId,
      buyer_user_id: kouadioId,
      status: 'shipped',
      total_xof: 32000,
      created_by: kouadioId,
    },
  ]);

  /* ── Order Items ───────────────────────────────────── */

  await knex('order_items').insert([
    /* Order 1 — 2x Wax + 1x Bazin */
    { id: randomUUID(), order_id: order1Id, product_id: pWax, quantity: 2, unit_price_xof: 18500, line_total_xof: 37000 },
    { id: randomUUID(), order_id: order1Id, product_id: pCoton, quantity: 5, unit_price_xof: 5500, line_total_xof: 26500 },

    /* Order 2 — 1x Bazin */
    { id: randomUUID(), order_id: order2Id, product_id: pBazin, quantity: 1, unit_price_xof: 45000, line_total_xof: 45000 },

    /* Order 3 — Poivre + Gingembre + Curcuma */
    { id: randomUUID(), order_id: order3Id, product_id: pPoivre, quantity: 1, unit_price_xof: 12000, line_total_xof: 12000 },
    { id: randomUUID(), order_id: order3Id, product_id: pGingembre, quantity: 2, unit_price_xof: 7500, line_total_xof: 15000 },
    { id: randomUUID(), order_id: order3Id, product_id: pCurcuma, quantity: 1, unit_price_xof: 4500, line_total_xof: 4500 },

    /* Order 4 — 2x Poivre */
    { id: randomUUID(), order_id: order4Id, product_id: pPoivre, quantity: 2, unit_price_xof: 12000, line_total_xof: 24000 },

    /* Order 5 — 1x Kenté (expédiée) */
    { id: randomUUID(), order_id: order5Id, product_id: pKente, quantity: 1, unit_price_xof: 32000, line_total_xof: 32000 },
  ]);

  /* ══════════════════════════════════════════════════════
     PAYMENTS — 2 paiements (1 completed, 1 pending)
     ══════════════════════════════════════════════════════ */

  const pay1Id = randomUUID(); // completed — order2
  const pay2Id = randomUUID(); // completed — order3
  const pay3Id = randomUUID(); // completed — order5

  await knex('payments').insert([
    {
      id: pay1Id,
      order_id: order2Id,
      wholesaler_org_id: orgTissusId,
      provider: 'mock_mobile_money',
      provider_ref: 'SIM_1716200000001',
      status: 'completed',
      amount_xof: 45000,
      idempotency_key: `pay_${randomUUID()}`,
      created_by: kouadioId,
    },
    {
      id: pay2Id,
      order_id: order3Id,
      wholesaler_org_id: orgEpicesId,
      provider: 'mock_mobile_money',
      provider_ref: 'SIM_1716200000002',
      status: 'completed',
      amount_xof: 31500,
      idempotency_key: `pay_${randomUUID()}`,
      created_by: kouadioId,
    },
    {
      id: pay3Id,
      order_id: order5Id,
      wholesaler_org_id: orgTissusId,
      provider: 'mock_mobile_money',
      provider_ref: 'SIM_1716200000003',
      status: 'completed',
      amount_xof: 32000,
      idempotency_key: `pay_${randomUUID()}`,
      created_by: kouadioId,
    },
  ]);

  /* Link payments to orders */
  await knex('orders').where({ id: order2Id }).update({ payment_id: pay1Id });
  await knex('orders').where({ id: order3Id }).update({ payment_id: pay2Id });
  await knex('orders').where({ id: order5Id }).update({ payment_id: pay3Id });

  /* ══════════════════════════════════════════════════════
     ORDER EVENTS — timeline de chaque commande
     ══════════════════════════════════════════════════════ */

  await knex('order_events').insert([
    /* Order 1 — pending : un seul event "placed" */
    {
      id: randomUUID(),
      order_id: order1Id,
      status: 'pending',
      notes: 'Commande passée par Kouadio',
      created_by: kouadioId,
    },

    /* Order 2 — paid : placed → accepted → paid */
    {
      id: randomUUID(),
      order_id: order2Id,
      status: 'pending',
      notes: 'Commande passée par Kouadio',
      created_by: kouadioId,
    },
    {
      id: randomUUID(),
      order_id: order2Id,
      status: 'accepted',
      notes: 'Commande acceptée par Aya',
      created_by: ayaId,
    },
    {
      id: randomUUID(),
      order_id: order2Id,
      status: 'paid',
      notes: 'Paiement Mobile Money confirmé — réf. SIM_1716200000001',
      created_by: null, // événement système (webhook)
    },

    /* Order 3 — delivered : placed → accepted → paid → delivered */
    {
      id: randomUUID(),
      order_id: order3Id,
      status: 'pending',
      notes: 'Commande passée par Kouadio',
      created_by: kouadioId,
    },
    {
      id: randomUUID(),
      order_id: order3Id,
      status: 'accepted',
      notes: 'Commande acceptée par Moussa',
      created_by: moussaId,
    },
    {
      id: randomUUID(),
      order_id: order3Id,
      status: 'paid',
      notes: 'Paiement Mobile Money confirmé — réf. SIM_1716200000002',
      created_by: null, // événement système (webhook)
    },
    {
      id: randomUUID(),
      order_id: order3Id,
      status: 'delivered',
      notes: 'Commande livrée par Épices du Marché',
      created_by: moussaId,
    },

    /* Order 4 — accepted : placed → accepted */
    {
      id: randomUUID(),
      order_id: order4Id,
      status: 'pending',
      notes: 'Commande passée par Kouadio',
      created_by: kouadioId,
    },
    {
      id: randomUUID(),
      order_id: order4Id,
      status: 'accepted',
      notes: 'Commande acceptée — en attente de paiement',
      created_by: moussaId,
    },

    /* Order 5 — shipped : placed → accepted → paid → shipped */
    {
      id: randomUUID(),
      order_id: order5Id,
      status: 'pending',
      notes: 'Commande passée par Kouadio',
      created_by: kouadioId,
    },
    {
      id: randomUUID(),
      order_id: order5Id,
      status: 'accepted',
      notes: 'Commande acceptée par Aya',
      created_by: ayaId,
    },
    {
      id: randomUUID(),
      order_id: order5Id,
      status: 'paid',
      notes: 'Paiement Mobile Money confirmé — réf. SIM_1716200000003',
      created_by: null, // événement système (webhook)
    },
    {
      id: randomUUID(),
      order_id: order5Id,
      status: 'shipped',
      notes: "Commande expédiée par Tissus d'Aya",
      created_by: ayaId,
    },
  ]);

  /* ══════════════════════════════════════════════════════
     CONVERSATIONS & MESSAGES — 2 conversations de démo
     ══════════════════════════════════════════════════════ */

  const conv1Id = randomUUID(); // Kouadio ↔ Tissus d'Aya
  const conv2Id = randomUUID(); // Kouadio ↔ Épices du Marché

  await knex('conversations').insert([
    { id: conv1Id, buyer_user_id: kouadioId, wholesaler_org_id: orgTissusId, created_by: kouadioId },
    { id: conv2Id, buyer_user_id: kouadioId, wholesaler_org_id: orgEpicesId, created_by: kouadioId },
  ]);

  await knex('messages').insert([
    // Conversation Tissus d'Aya
    { id: randomUUID(), conversation_id: conv1Id, sender_user_id: kouadioId, body: 'Bonjour Aya, avez-vous du wax hollandais disponible ?', created_by: kouadioId },
    { id: randomUUID(), conversation_id: conv1Id, sender_user_id: ayaId, body: 'Bonjour Kouadio ! Oui, nous avons 150 rouleaux en stock. Quel coloris vous intéresse ?', created_by: ayaId },
    { id: randomUUID(), conversation_id: conv1Id, sender_user_id: kouadioId, body: 'Je cherche des tons chauds, orange et rouge. Vous pouvez me montrer les références disponibles ?', created_by: kouadioId },

    // Conversation Épices du Marché (message non lu)
    { id: randomUUID(), conversation_id: conv2Id, sender_user_id: kouadioId, body: 'Bonjour, quel est votre délai de livraison pour le poivre noir en vrac ?', created_by: kouadioId },
    { id: randomUUID(), conversation_id: conv2Id, sender_user_id: moussaId, body: 'Bonjour ! Livraison sous 48h dans Abidjan. Pour des commandes > 10kg, nous offrons la livraison gratuite.', created_by: moussaId },
  ]);

  /* ── Summary ───────────────────────────────────────── */

  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║          MarchéLink — Données de test            ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║  Mot de passe unique : MarcheLink2026!           ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║  ACHETEUR (buyer)                                ║');
  console.log('║    kouadio@boutique.ci                           ║');
  console.log('║                                                  ║');
  console.log('║  GROSSISTES (wholesaler_admin)                   ║');
  console.log("║    aya@tissus.ci      → Tissus d'Aya             ║");
  console.log('║    moussa@epices.ci   → Épices du Marché         ║');
  console.log('║                                                  ║');
  console.log('║  ADMIN PLATEFORME                                ║');
  console.log('║    admin@marchelink.ci                           ║');
  console.log('║                                                  ║');
  console.log('║  10 produits • 5 commandes • 3 paiements         ║');
  console.log('║  14 order_events (timelines complètes)           ║');
  console.log('║  2 conversations • 5 messages                    ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
}
