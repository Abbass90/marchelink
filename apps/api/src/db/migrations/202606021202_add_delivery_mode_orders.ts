import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('orders', (table) => {
    // NULL justifié : le mode de livraison est choisi par le grossiste après
    // acceptation ; la commande n'a pas encore de mode à la création.
    table.string('delivery_mode', 16).nullable();
  });

  // Contrainte CHECK côté SQL pour éviter les valeurs inattendues.
  await knex.raw(`
    ALTER TABLE orders
    ADD CONSTRAINT chk_delivery_mode
    CHECK (delivery_mode IN ('wholesaler', 'swiftgo'))
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_delivery_mode');

  await knex.schema.alterTable('orders', (table) => {
    table.dropColumn('delivery_mode');
  });
}
