import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('conversations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    // FK: l'acheteur qui a ouvert la conversation
    table.uuid('buyer_user_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    // FK: l'org grossiste ciblée
    table.uuid('wholesaler_org_id').notNullable().references('id').inTable('organizations').onDelete('RESTRICT');
    // Colonnes d'audit obligatoires (CLAUDE.md §2)
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.uuid('created_by').nullable();
    table.uuid('updated_by').nullable();
    // Soft delete (CLAUDE.md §3)
    table.timestamp('deleted_at', { useTz: true }).nullable();

    // Une seule conversation par (buyer, org) — unicité métier
    table.unique(['buyer_user_id', 'wholesaler_org_id']);
    table.index(['buyer_user_id', 'deleted_at'], 'idx_conversations_buyer_deleted');
    table.index(['wholesaler_org_id', 'deleted_at'], 'idx_conversations_org_deleted');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('conversations');
}
