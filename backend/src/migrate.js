// Applies schema.sql to DATABASE_URL (e.g. your Supabase project): `npm run migrate`
import 'dotenv/config';
import { loadConfig } from './config.js';
import { createPgDatabase, migrate } from './db/index.js';

const config = loadConfig();
if (!config.databaseUrl) {
  console.error('DATABASE_URL is not set. The embedded database migrates itself on startup.');
  process.exit(1);
}

const db = createPgDatabase(config.databaseUrl, { ssl: config.databaseSsl });
await migrate(db);
await db.close();
console.log('Schema applied.');
