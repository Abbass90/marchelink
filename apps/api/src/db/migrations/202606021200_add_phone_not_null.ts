import type { Knex } from 'knex';

/**
 * §9 — Rendre le numéro de téléphone obligatoire (NOT NULL).
 *
 * up()   : backfill des lignes NULL avec un placeholder valide, puis ALTER NOT NULL.
 * down() : repasse la colonne en nullable (CLAUDE.md Rule 3).
 */

export async function up(knex: Knex): Promise<void> {
  // Backfill obligatoire avant d'imposer NOT NULL.
  // Le placeholder '+2250000000000' respecte le format +225XXXXXXXXXX.
  await knex('users')
    .whereNull('phone')
    .update({ phone: '+2250000000000' });

  await knex.schema.alterTable('users', (table) => {
    // notNullable() + alter() = ALTER COLUMN … SET NOT NULL
    table.string('phone', 20).notNullable().alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    table.string('phone', 20).nullable().alter();
  });
}
