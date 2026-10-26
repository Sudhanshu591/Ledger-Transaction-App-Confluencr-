export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT) || 4000,
    // Postgres connection string (e.g. Supabase). When empty, an embedded Postgres (PGlite) is used.
    databaseUrl: env.DATABASE_URL || '',
    databaseSsl: env.DATABASE_SSL === 'true',
    pgliteDataDir: env.PGLITE_DATA_DIR || './.data/ledger',
    // Comma-separated list of allowed frontend origins; "*" allows all.
    corsOrigin: env.CORS_ORIGIN || '*',
  };
}
