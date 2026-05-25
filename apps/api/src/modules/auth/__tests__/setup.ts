import knexLib, { type Knex } from 'knex';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let testDb: Knex;

export function getTestDb(): Knex {
  if (!testDb) {
    testDb = knexLib({
      client: 'pg',
      connection: process.env.DATABASE_URL_TEST ?? 'postgres://kansoabbas@localhost:5432/marchelink_test',
      migrations: {
        directory: path.join(__dirname, '../../../db/migrations'),
        extension: 'ts',
      },
    });
  }
  return testDb;
}

export async function setupTestDb(): Promise<void> {
  const db = getTestDb();
  await db.migrate.latest();
}

export async function teardownTestDb(): Promise<void> {
  const db = getTestDb();
  await db.destroy();
}

export async function cleanTables(): Promise<void> {
  const db = getTestDb();
  await db.raw('TRUNCATE TABLE messages, conversations, order_events, deliveries, payments, order_items, orders, refresh_tokens, users, organizations, products CASCADE');
}
