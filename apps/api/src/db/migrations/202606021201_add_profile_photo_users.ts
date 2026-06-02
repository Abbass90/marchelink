import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    // NULL justifié : colonne ajoutée après le schéma initial ;
    // les utilisateurs existants n'ont pas de photo.
    table.text('profile_photo').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('profile_photo');
  });
}
