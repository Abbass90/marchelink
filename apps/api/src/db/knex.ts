import knexLib from 'knex';
import config from '../config/knexfile.js';

const env = process.env.NODE_ENV ?? 'development';
const knexConfig = config[env];

if (!knexConfig) {
  throw new Error(`No knex config for env: ${env}`);
}

export const db = knexLib(knexConfig);
