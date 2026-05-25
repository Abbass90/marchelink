import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('orders', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('wholesaler_org_id').notNullable().references('id').inTable('organizations').onDelete('RESTRICT');
    table.uuid('buyer_user_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table
      .enum('status', ['pending', 'accepted', 'rejected', 'cancelled', 'paid', 'delivered'], {
        useNative: true,
        enumName: 'order_status_enum',
      })
      .notNullable()
      .defaultTo('pending');
    table.bigInteger('total_xof').notNullable();
    table.uuid('payment_id').nullable();
    table.uuid('delivery_id').nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.uuid('created_by').nullable();
    table.uuid('updated_by').nullable();
    table.timestamp('deleted_at', { useTz: true }).nullable();

    table.index(['wholesaler_org_id', 'status']);
    table.index(['buyer_user_id', 'created_at']);
    table.index(['wholesaler_org_id', 'deleted_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('orders');
  await knex.raw('DROP TYPE IF EXISTS order_status_enum');
}
