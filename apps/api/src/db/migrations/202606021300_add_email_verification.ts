import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Ajouter email_verified_at sur users
  await knex.schema.alterTable('users', (table) => {
    table.timestamp('email_verified_at', { useTz: true }).nullable().defaultTo(null);
  });

  // 2. Créer la table des tokens de vérification d'email
  await knex.schema.createTable('email_verification_tokens', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('token_hash', 64).notNullable().unique();
    table.timestamp('expires_at', { useTz: true }).notNullable();
    table.timestamp('used_at', { useTz: true }).nullable().defaultTo(null);
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index(['user_id']);
    table.index(['token_hash']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('email_verification_tokens');
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('email_verified_at');
  });
}
