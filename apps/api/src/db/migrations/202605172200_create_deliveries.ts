import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
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
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('deliveries');
  await knex.raw('DROP TYPE IF EXISTS delivery_status_enum');
}
