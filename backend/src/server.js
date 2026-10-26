import 'dotenv/config';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createPgDatabase, createPgliteDatabase, migrate } from './db/index.js';

const config = loadConfig();

const db = config.databaseUrl
  ? createPgDatabase(config.databaseUrl, { ssl: config.databaseSsl })
  : await createPgliteDatabase(config.pgliteDataDir);

await migrate(db);

const server = createApp({ db, corsOrigin: config.corsOrigin }).listen(config.port, () => {
  const target = config.databaseUrl ? 'PostgreSQL (DATABASE_URL)' : `embedded PGlite at ${config.pgliteDataDir}`;
  console.log(`Ledger API listening on http://localhost:${config.port} using ${target}`);
  console.log(`CORS allowed origins: ${[].concat(config.corsOrigin).join(', ')}`);
});

const shutdown = () => server.close(() => db.close().finally(() => process.exit(0)));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
