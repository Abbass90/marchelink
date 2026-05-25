import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw("ALTER TYPE order_status_enum ADD VALUE IF NOT EXISTS 'shipped' AFTER 'paid'");
}

export async function down(knex: Knex): Promise<void> {
  // PostgreSQL does not support removing a value from an enum.
  // To fully rollback, recreate the enum — but that requires dropping/recreating the column.
  // For safety, this is a no-op. The extra enum value is harmless.
}
