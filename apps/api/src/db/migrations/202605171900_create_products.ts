import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('products', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('organization_id').notNullable().references('id').inTable('organizations').onDelete('RESTRICT');
    table.string('sku', 50).notNullable();
    table.string('name', 255).notNullable();
    table.text('description').nullable();
    table.bigInteger('price_xof').notNullable();
    table.integer('stock_qty').notNullable().defaultTo(0);
    table.string('unit', 50).notNullable().defaultTo('unité');
    table.string('image_url', 500).nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.uuid('created_by').nullable();
    table.uuid('updated_by').nullable();
    table.timestamp('deleted_at', { useTz: true }).nullable();

    table.unique(['organization_id', 'sku']);
    table.index(['organization_id', 'created_at']);
    table.index(['organization_id', 'deleted_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('products');
}
