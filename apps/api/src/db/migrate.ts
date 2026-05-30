import 'dotenv/config';
import knexLib from 'knex';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const env = process.env.NODE_ENV ?? 'development';
const connectionUrl =
  env === 'test' ? process.env.DATABASE_URL_TEST : process.env.DATABASE_URL;

const db = knexLib({
  client: 'pg',
  connection: connectionUrl ?? '',
  migrations: {
    directory: path.join(__dirname, 'migrations'),
    extension: 'ts',
  },
  seeds: { directory: path.join(__dirname, 'seeds') },
});

const command = process.argv[2] ?? 'latest';

async function run() {
  if (command === 'latest') {
    const [batch, migrations] = await db.migrate.latest();
    console.log(`Batch ${batch}: ${migrations.length} migrations applied`);
    migrations.forEach((m: string) => console.log(`  ✓ ${m}`));
  } else if (command === 'rollback') {
    const [batch, migrations] = await db.migrate.rollback();
    console.log(`Batch ${batch}: ${migrations.length} migrations rolled back`);
    migrations.forEach((m: string) => console.log(`  ↩ ${m}`));
  } else if (command === 'seed') {
    await db.seed.run();
    console.log('Seeds applied');
  }
  await db.destroy();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
