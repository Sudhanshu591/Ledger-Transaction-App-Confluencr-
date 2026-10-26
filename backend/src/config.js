export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT) || 4000,
    // Postgres connection string (e.g. Supabase). When empty, an embedded Postgres (PGlite) is used.
    databaseUrl: env.DATABASE_URL || '',
    databaseSsl: env.DATABASE_SSL === 'true',
    pgliteDataDir: env.PGLITE_DATA_DIR || './.data/ledger',
    // Comma-separated list of allowed frontend origins; "*" allows all.
    corsOrigin: parseCorsOrigin(env.CORS_ORIGIN),
  };
}

/**
 * Browsers send the Origin header as scheme://host[:port] with no trailing slash, and CORS matching is exact.
 * Normalise values pasted into a hosting dashboard (quotes, spaces, trailing "/", capitals) so they still match.
 */
export function parseCorsOrigin(value) {
  const origins = (value ?? '')
    .split(',')
    .map((o) => o.trim().replace(/^["']|["']$/g, '').trim().replace(/\/+$/, '').toLowerCase())
    .filter(Boolean);
  return origins.length === 0 || origins.includes('*') ? '*' : origins;
}
