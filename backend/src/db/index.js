import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

/**
 * Both adapters expose the same small interface so services stay database-agnostic:
 *   query(sql, params)  -> { rows }
 *   exec(sql)           -> runs a multi-statement script
 *   transaction(fn)     -> runs fn({ query }) inside BEGIN/COMMIT, rolls back on throw
 *   close()
 */

// Return NUMERIC as string (pg default) so money is never parsed as a float in the DB layer.
export function createPgDatabase(connectionString, { ssl = false } = {}) {
  const pool = new pg.Pool({
    connectionString,
    ssl: ssl ? { rejectUnauthorized: false } : undefined,
    max: 10,
  });

  return {
    query: (text, params) => pool.query(text, params),
    exec: (text) => pool.query(text),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn({ query: (text, params) => client.query(text, params) });
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

// Embedded Postgres (WASM) for zero-setup local runs and tests. dataDir undefined = in-memory.
export async function createPgliteDatabase(dataDir) {
  const { PGlite } = await import('@electric-sql/pglite');
  // PGlite creates only the last path segment, so ensure the parents exist.
  if (dataDir) await mkdir(path.dirname(path.resolve(dataDir)), { recursive: true });
  const db = new PGlite(dataDir);
  await db.waitReady;

  return {
    query: (text, params) => db.query(text, params),
    exec: (text) => db.exec(text),
    transaction: (fn) => db.transaction((tx) => fn({ query: (text, params) => tx.query(text, params) })),
    close: () => db.close(),
  };
}

export async function migrate(db) {
  const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  await db.exec(schema);
}
