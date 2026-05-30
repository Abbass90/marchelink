import 'dotenv/config';
import type { Knex } from 'knex';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const shared: Knex.Config = {
  client: 'pg',
  pool: { min: 2, max: 10 },
  migrations: {
    directory: path.join(__dirname, '../db/migrations'),
    extension: 'ts',
  },
  seeds: { directory: path.join(__dirname, '../db/seeds') },
};

const config: Record<string, Knex.Config> = {
  development: {
    ...shared,
    connection: process.env.DATABASE_URL ?? '',
  },
  test: {
    ...shared,
    connection: process.env.DATABASE_URL_TEST ?? '',
  },
  production: {
    ...shared,
    connection: process.env.DATABASE_URL ?? '',
    pool: { min: 4, max: 20 },
  },
};

export default config;
