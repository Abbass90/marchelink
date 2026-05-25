import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('messages', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    // FK: conversation parente
    table.uuid('conversation_id').notNullable().references('id').inTable('conversations').onDelete('RESTRICT');
    // FK: utilisateur qui a envoyé le message (buyer ou user du grossiste)
    table.uuid('sender_user_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    // Corps du message — NOT NULL par design métier
    table.text('body').notNullable();
    // NULL = non lu, renseigné quand le destinataire a lu le message
    table.timestamp('read_at', { useTz: true }).nullable();
    // Colonnes d'audit obligatoires (CLAUDE.md §2)
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.uuid('created_by').nullable();
    table.uuid('updated_by').nullable();
    // Soft delete (CLAUDE.md §3)
    table.timestamp('deleted_at', { useTz: true }).nullable();

    // Index composite pour les requêtes de fil de messages
    table.index(['conversation_id', 'created_at'], 'idx_messages_conv_created');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('messages');
}
