import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('email', 320).notNullable().unique();
    table.string('password_hash', 255).notNullable();
    table
      .enum('role', ['platform_admin', 'wholesaler_admin', 'wholesaler_seller', 'delivery_operator', 'buyer'])
      .notNullable();
    table.uuid('organization_id').nullable().references('id').inTable('organizations').onDelete('RESTRICT');
    table.string('phone', 20).nullable();
    table.string('first_name', 100).notNullable();
    table.string('last_name', 100).notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.uuid('created_by').nullable();
    table.uuid('updated_by').nullable();
    table.timestamp('deleted_at', { useTz: true }).nullable();

    table.index(['organization_id', 'created_at']);
    table.index(['email']);
  });

  // CHECK: buyer → organization_id IS NULL; autres rôles → organization_id IS NOT NULL
  await knex.raw(`
    ALTER TABLE users ADD CONSTRAINT chk_buyer_no_org
    CHECK (
      (role IN ('buyer', 'platform_admin') AND organization_id IS NULL)
      OR (role NOT IN ('buyer', 'platform_admin') AND organization_id IS NOT NULL)
    )
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('users');
}
