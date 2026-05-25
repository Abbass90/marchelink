import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('payments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('order_id').notNullable().references('id').inTable('orders').onDelete('RESTRICT');
    table.uuid('wholesaler_org_id').notNullable().references('id').inTable('organizations').onDelete('RESTRICT');
    table.string('provider', 50).notNullable().defaultTo('mock_mobile_money');
    table.string('provider_ref', 255).nullable();
    table
      .enum('status', ['pending', 'completed', 'failed'], {
        useNative: true,
        enumName: 'payment_status_enum',
      })
      .notNullable()
      .defaultTo('pending');
    table.bigInteger('amount_xof').notNullable();
    table.string('idempotency_key', 255).notNullable().unique();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.uuid('created_by').nullable();
    table.uuid('updated_by').nullable();
    table.timestamp('deleted_at', { useTz: true }).nullable();

    table.index(['order_id']);
    table.index(['wholesaler_org_id', 'status']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('payments');
  await knex.raw('DROP TYPE IF EXISTS payment_status_enum');
}
