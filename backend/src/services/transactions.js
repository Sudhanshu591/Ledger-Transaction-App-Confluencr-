import { DuplicateTransactionError, InsufficientBalanceError, TransactionNotFoundError } from '../errors.js';
import { toPagination, toTransaction } from '../mappers.js';
import { getAccount, lockAccount } from './accounts.js';

const UNIQUE_VIOLATION = '23505';

async function findByReference(db, accountId, referenceId) {
  const { rows } = await db.query('SELECT * FROM transactions WHERE account_id = $1 AND reference_id = $2', [
    accountId,
    referenceId,
  ]);
  return rows[0] ? toTransaction(rows[0]) : null;
}

/**
 * Moves the stored balance. The debit is conditional (balance >= amount) inside the same
 * UPDATE, so the check and the write cannot be separated by a concurrent request.
 */
export async function applyBalanceChange(tx, account, type, amount) {
  const sql =
    type === 'credit'
      ? 'UPDATE accounts SET balance = balance + $2 WHERE id = $1 RETURNING balance'
      : 'UPDATE accounts SET balance = balance - $2 WHERE id = $1 AND balance >= $2 RETURNING balance';
  const { rows } = await tx.query(sql, [account.id, amount]);
  if (rows.length === 0) {
    throw new InsufficientBalanceError({
      accountId: account.id,
      balance: Number(account.balance),
      requested: Number(amount),
    });
  }
}

export async function insertTransaction(tx, { accountId, type, amount, description, referenceId, transferId = null }) {
  const { rows } = await tx.query(
    `INSERT INTO transactions (account_id, type, amount, description, reference_id, transfer_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [accountId, type, amount, description, referenceId, transferId],
  );
  return toTransaction(rows[0]);
}

export async function createTransaction(db, input) {
  try {
    return await db.transaction(async (tx) => {
      // Lock the account row: concurrent writes to the same account are serialized from here on.
      const account = await lockAccount(tx, input.account_id);

      const existing = await findByReference(tx, account.id, input.reference_id);
      if (existing) throw new DuplicateTransactionError(existing);

      await applyBalanceChange(tx, account, input.type, input.amount);
      return insertTransaction(tx, {
        accountId: account.id,
        type: input.type,
        amount: input.amount,
        description: input.description,
        referenceId: input.reference_id,
      });
    });
  } catch (err) {
    // Safety net: the unique constraint is the final arbiter of duplicates.
    if (err.code === UNIQUE_VIOLATION) {
      const existing = await findByReference(db, input.account_id, input.reference_id);
      if (existing) throw new DuplicateTransactionError(existing);
    }
    throw err;
  }
}

export async function getTransaction(db, transactionId) {
  const { rows } = await db.query('SELECT * FROM transactions WHERE id = $1', [transactionId]);
  if (rows.length === 0) throw new TransactionNotFoundError(transactionId);
  return toTransaction(rows[0]);
}

export async function listTransactions(db, accountId, { type, page, limit }) {
  await getAccount(db, accountId);

  const params = [accountId];
  let where = 'account_id = $1';
  if (type) {
    params.push(type);
    where += ' AND type = $2';
  }

  const { rows: countRows } = await db.query(`SELECT count(*)::int AS total FROM transactions WHERE ${where}`, params);
  const { rows } = await db.query(
    `SELECT * FROM transactions WHERE ${where}
     ORDER BY created_at DESC, seq DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, (page - 1) * limit],
  );

  return { data: rows.map(toTransaction), pagination: toPagination(page, limit, countRows[0].total) };
}
