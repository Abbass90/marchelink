import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('favorites', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('buyer_user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    table
      .uuid('product_id')
      .notNullable()
      .references('id')
      .inTable('products')
      .onDelete('RESTRICT');

    // Audit columns (CLAUDE.md §2)
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.uuid('created_by').nullable(); // NULL when operation is system-initiated
    table.uuid('updated_by').nullable();

    // Soft delete (CLAUDE.md §3)
    table.timestamp('deleted_at', { useTz: true }).nullable();
  });

  // Performance indexes
  await knex.schema.table('favorites', (table) => {
    table.index(['buyer_user_id'], 'favorites_buyer_user_id_idx');
    table.index(['product_id'], 'favorites_product_id_idx');
  });

  // Unique: one active favorite per (buyer, product) — WHERE deleted_at IS NULL
  await knex.raw(`
    CREATE UNIQUE INDEX favorites_buyer_product_unique_idx
      ON favorites (buyer_user_id, product_id)
      WHERE deleted_at IS NULL
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS favorites_buyer_product_unique_idx');
  await knex.schema.dropTableIfExists('favorites');
}
