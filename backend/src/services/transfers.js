import { DuplicateTransferError, SameAccountTransferError, TransferNotFoundError } from '../errors.js';
import { toTransaction, toTransfer } from '../mappers.js';
import { lockAccount } from './accounts.js';
import { applyBalanceChange, insertTransaction } from './transactions.js';

const UNIQUE_VIOLATION = '23505';

async function findByReference(db, fromAccountId, referenceId) {
  const { rows } = await db.query('SELECT * FROM transfers WHERE from_account_id = $1 AND reference_id = $2', [
    fromAccountId,
    referenceId,
  ]);
  return rows[0] ? toTransfer(rows[0]) : null;
}

/**
 * Debit source + credit destination + transfer record + two ledger entries,
 * all in one DB transaction. Any failure rolls everything back: no partial transfers.
 */
export async function createTransfer(db, input) {
  if (input.from_account_id === input.to_account_id) throw new SameAccountTransferError();

  try {
    return await db.transaction(async (tx) => {
      // Lock both accounts in a fixed (id) order so opposite-direction transfers can't deadlock.
      const locked = {};
      for (const id of [input.from_account_id, input.to_account_id].sort()) {
        locked[id] = await lockAccount(tx, id);
      }
      const source = locked[input.from_account_id];
      const destination = locked[input.to_account_id];

      const existing = await findByReference(tx, source.id, input.reference_id);
      if (existing) throw new DuplicateTransferError(existing);

      await applyBalanceChange(tx, source, 'debit', input.amount);
      await applyBalanceChange(tx, destination, 'credit', input.amount);

      const { rows } = await tx.query(
        `INSERT INTO transfers (from_account_id, to_account_id, amount, description, reference_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [source.id, destination.id, input.amount, input.description, input.reference_id],
      );
      const transfer = toTransfer(rows[0]);

      const common = { amount: input.amount, transferId: transfer.id };
      const debit = await insertTransaction(tx, {
        ...common,
        accountId: source.id,
        type: 'debit',
        description: input.description ?? `Transfer to ${destination.name}`,
        referenceId: `transfer:${transfer.id}:out`,
      });
      const credit = await insertTransaction(tx, {
        ...common,
        accountId: destination.id,
        type: 'credit',
        description: input.description ?? `Transfer from ${source.name}`,
        referenceId: `transfer:${transfer.id}:in`,
      });

      return { ...transfer, debit_transaction: debit, credit_transaction: credit };
    });
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) {
      const existing = await findByReference(db, input.from_account_id, input.reference_id);
      if (existing) throw new DuplicateTransferError(existing);
    }
    throw err;
  }
}

export async function getTransfer(db, transferId) {
  const { rows } = await db.query('SELECT * FROM transfers WHERE id = $1', [transferId]);
  if (rows.length === 0) throw new TransferNotFoundError(transferId);
  const { rows: entries } = await db.query('SELECT * FROM transactions WHERE transfer_id = $1', [transferId]);
  const find = (type) => entries.find((e) => e.type === type);
  return {
    ...toTransfer(rows[0]),
    debit_transaction: toTransaction(find('debit')),
    credit_transaction: toTransaction(find('credit')),
  };
}
