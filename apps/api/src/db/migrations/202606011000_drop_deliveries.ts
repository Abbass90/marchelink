import type { Knex } from 'knex';

/**
 * Suppression du domaine « livraison ».
 * Plus de rôle livreur séparé : c'est désormais le grossiste qui pilote tout le
 * cycle aval d'une commande (paid → shipped → delivered, cf. order.service.ts).
 * On retire donc la table `deliveries`, son enum natif et la colonne
 * `orders.delivery_id` qui la référençait logiquement.
 *
 * NB : la valeur `delivery_operator` de l'enum `role` (table users) est laissée
 * en place volontairement — la retirer imposerait de reconstruire un enum natif
 * PostgreSQL + la contrainte CHECK sur une base de prod (risque non justifié).
 * Plus aucun code applicatif ne l'utilise.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('orders', (table) => {
    table.dropColumn('delivery_id');
  });
  await knex.schema.dropTableIfExists('deliveries');
  await knex.raw('DROP TYPE IF EXISTS delivery_status_enum');
}

export async function down(knex: Knex): Promise<void> {
  // Rollback complet : recrée la table `deliveries` + la colonne `orders.delivery_id`
  // à l'identique de leur définition d'origine (202605172200_create_deliveries).
  await knex.schema.createTable('deliveries', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('order_id').notNullable().references('id').inTable('orders').onDelete('RESTRICT');
    table.uuid('wholesaler_org_id').notNullable().references('id').inTable('organizations').onDelete('RESTRICT');
    table.uuid('assigned_to_user_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table
      .enum('status', ['assigned', 'in_transit', 'delivered'], {
        useNative: true,
        enumName: 'delivery_status_enum',
      })
      .notNullable()
      .defaultTo('assigned');
    table.timestamp('completed_at', { useTz: true }).nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.uuid('created_by').nullable();
    table.uuid('updated_by').nullable();
    table.timestamp('deleted_at', { useTz: true }).nullable();

    table.index(['wholesaler_org_id', 'status']);
    table.index(['assigned_to_user_id', 'status']);
    table.index(['order_id']);
  });

  await knex.schema.alterTable('orders', (table) => {
    table.uuid('delivery_id').nullable();
  });
}
