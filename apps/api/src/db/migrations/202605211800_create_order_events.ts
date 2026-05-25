import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('order_events', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    // FK vers orders — un event appartient à une commande
    table.uuid('order_id').notNullable().references('id').inTable('orders').onDelete('RESTRICT');
    // Copie du statut cible au moment de l'event (dénormalisé pour lecture directe)
    table.string('status', 50).notNullable();
    // Notes libres (ex : motif de rejet) — nullable par design métier
    table.text('notes').nullable();
    // Colonnes d'audit obligatoires (CLAUDE.md §2)
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    // created_by / updated_by nullable : l'event webhook paiement est système (pas d'user)
    table.uuid('created_by').nullable().references('id').inTable('users').onDelete('RESTRICT');
    table.uuid('updated_by').nullable().references('id').inTable('users').onDelete('RESTRICT');
    // Soft delete (CLAUDE.md §3)
    table.timestamp('deleted_at', { useTz: true }).nullable();
    // Index composite pour les requêtes de timeline (order_id + ordre chronologique)
    table.index(['order_id', 'created_at'], 'idx_order_events_order_id_created_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('order_events');
}
