import { AccountNotFoundError } from '../errors.js';
import { toAccount, toPagination } from '../mappers.js';

export async function createAccount(db, { name }) {
  // balance and created_at come from column defaults; the client can never set them.
  const { rows } = await db.query('INSERT INTO accounts (name) VALUES ($1) RETURNING *', [name]);
  return toAccount(rows[0]);
}

export async function getAccount(db, accountId) {
  const { rows } = await db.query('SELECT * FROM accounts WHERE id = $1', [accountId]);
  if (rows.length === 0) throw new AccountNotFoundError(accountId);
  return toAccount(rows[0]);
}

export async function getBalance(db, accountId) {
  const account = await getAccount(db, accountId);
  return { account_id: account.id, balance: account.balance };
}

export async function listAccounts(db, { page, limit }) {
  const { rows: countRows } = await db.query('SELECT count(*)::int AS total FROM accounts');
  const { rows } = await db.query('SELECT * FROM accounts ORDER BY created_at DESC, id LIMIT $1 OFFSET $2', [
    limit,
    (page - 1) * limit,
  ]);
  return { data: rows.map(toAccount), pagination: toPagination(page, limit, countRows[0].total) };
}

/** Row-locks an account for the rest of the surrounding DB transaction. */
export async function lockAccount(tx, accountId) {
  const { rows } = await tx.query('SELECT * FROM accounts WHERE id = $1 FOR UPDATE', [accountId]);
  if (rows.length === 0) throw new AccountNotFoundError(accountId);
  return rows[0];
}
