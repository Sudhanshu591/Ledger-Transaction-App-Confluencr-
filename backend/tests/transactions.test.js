import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { setup } from './helpers.js';

describe('Transactions', () => {
  let ctx;
  before(async () => (ctx = await setup()));
  after(() => ctx.close());

  test('credit increases and debit decreases the balance', async () => {
    const { id } = await ctx.createAccount();
    const credit = await ctx.transact(id, 'credit', 100, { description: 'Salary' });
    assert.equal(credit.status, 201);
    assert.equal(credit.body.type, 'credit');
    assert.equal(credit.body.amount, 100);
    assert.equal(credit.body.description, 'Salary');

    await ctx.transact(id, 'credit', 50);
    assert.equal(await ctx.balanceOf(id), 150);
    await ctx.transact(id, 'debit', 30);
    assert.equal(await ctx.balanceOf(id), 120);
  });

  test('debit with insufficient balance is rejected and changes nothing', async () => {
    const { id } = await ctx.createAccount();
    await ctx.transact(id, 'credit', 100);
    const res = await ctx.transact(id, 'debit', 150);
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'INSUFFICIENT_BALANCE');
    assert.equal(res.body.error.details.balance, 100);
    assert.equal(await ctx.balanceOf(id), 100);

    const history = await ctx.api.get(`/api/v1/accounts/${id}/transactions`);
    assert.equal(history.body.pagination.total_records, 1);
  });

  test('debit of exactly the full balance is allowed', async () => {
    const { id } = await ctx.createAccount();
    await ctx.transact(id, 'credit', 100);
    assert.equal((await ctx.transact(id, 'debit', 100)).status, 201);
    assert.equal(await ctx.balanceOf(id), 0);
  });

  test('duplicate reference_id on the same account returns 409 and changes nothing', async () => {
    const { id } = await ctx.createAccount();
    const first = await ctx.transact(id, 'credit', 100, { reference_id: 'INV-1' });
    const dup = await ctx.transact(id, 'credit', 100, { reference_id: 'INV-1' });
    assert.equal(dup.status, 409);
    assert.equal(dup.body.error.code, 'DUPLICATE_TRANSACTION');
    assert.equal(dup.body.error.details.existing_transaction.id, first.body.id);
    assert.equal(await ctx.balanceOf(id), 100);

    // Even a duplicate whose payload differs is rejected (reference_id is the idempotency key).
    const dupDebit = await ctx.transact(id, 'debit', 10, { reference_id: 'INV-1' });
    assert.equal(dupDebit.status, 409);
    assert.equal(await ctx.balanceOf(id), 100);
  });

  test('the same reference_id may be used on different accounts', async () => {
    const a = await ctx.createAccount('A');
    const b = await ctx.createAccount('B');
    assert.equal((await ctx.transact(a.id, 'credit', 10, { reference_id: 'SHARED' })).status, 201);
    assert.equal((await ctx.transact(b.id, 'credit', 10, { reference_id: 'SHARED' })).status, 201);
  });

  test('concurrent duplicates create exactly one transaction', async () => {
    const { id } = await ctx.createAccount();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => ctx.transact(id, 'credit', 10, { reference_id: 'RACE' })),
    );
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409, 409, 409, 409]);
    assert.equal(await ctx.balanceOf(id), 10);
  });

  test('validates input', async () => {
    const { id } = await ctx.createAccount();
    const cases = [
      [{ type: 'refund' }, 'INVALID_TRANSACTION_TYPE'],
      [{ type: undefined }, 'INVALID_TRANSACTION_TYPE'],
      [{ amount: 0 }, 'INVALID_AMOUNT'],
      [{ amount: -5 }, 'INVALID_AMOUNT'],
      [{ amount: '12.345' }, 'INVALID_AMOUNT'],
      [{ amount: 'abc' }, 'INVALID_AMOUNT'],
      [{ amount: undefined }, 'INVALID_AMOUNT'],
      [{ reference_id: '' }, 'VALIDATION_ERROR'],
      [{ reference_id: undefined }, 'VALIDATION_ERROR'],
      [{ account_id: 'xyz' }, 'INVALID_ACCOUNT_ID'],
    ];
    for (const [override, code] of cases) {
      const body = { account_id: id, type: 'credit', amount: 10, reference_id: `v-${code}`, ...override };
      const res = await ctx.api.post('/api/v1/transactions').send(body);
      assert.equal(res.status, 400, JSON.stringify(override));
      assert.equal(res.body.error.code, code, JSON.stringify(override));
    }
    assert.equal(await ctx.balanceOf(id), 0);
  });

  test('accepts numeric strings and keeps exact decimal math', async () => {
    const { id } = await ctx.createAccount();
    await ctx.transact(id, 'credit', 0.1);
    await ctx.transact(id, 'credit', '0.2');
    assert.equal(await ctx.balanceOf(id), 0.3);
  });

  test('transaction for a non-existent account returns 404', async () => {
    const res = await ctx.transact('00000000-0000-4000-8000-000000000000', 'credit', 10);
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'ACCOUNT_NOT_FOUND');
  });

  test('transactions cannot be updated or deleted through the API', async () => {
    const { id } = await ctx.createAccount();
    const txn = (await ctx.transact(id, 'credit', 10)).body;
    for (const method of ['put', 'patch', 'delete']) {
      const res = await ctx.api[method](`/api/v1/transactions/${txn.id}`).send({ amount: 999 });
      assert.equal(res.status, 405);
      assert.equal(res.body.error.code, 'METHOD_NOT_ALLOWED');
    }
    const fetched = await ctx.api.get(`/api/v1/transactions/${txn.id}`);
    assert.deepEqual(fetched.body, txn);
  });

  test('the database itself refuses to update or delete transactions', async () => {
    const { id } = await ctx.createAccount();
    const txn = (await ctx.transact(id, 'credit', 10)).body;
    await assert.rejects(ctx.db.query('UPDATE transactions SET amount = 1 WHERE id = $1', [txn.id]), /immutable/);
    await assert.rejects(ctx.db.query('DELETE FROM transactions WHERE id = $1', [txn.id]), /immutable/);
  });

  test('balance always equals credits minus debits (spec example)', async () => {
    const { id } = await ctx.createAccount();
    await ctx.transact(id, 'credit', 100);
    await ctx.transact(id, 'credit', 50);
    await ctx.transact(id, 'debit', 30);
    await ctx.transact(id, 'debit', 20);
    await ctx.transact(id, 'debit', 1000); // rejected
    assert.equal(await ctx.balanceOf(id), 100);

    const { rows } = await ctx.db.query(
      `SELECT coalesce(sum(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) AS net
       FROM transactions WHERE account_id = $1`,
      [id],
    );
    assert.equal(Number(rows[0].net), 100);
  });

  test('the database rejects a negative balance even if application checks were bypassed', async () => {
    const { id } = await ctx.createAccount();
    await assert.rejects(ctx.db.query('UPDATE accounts SET balance = -1 WHERE id = $1', [id]), /check constraint/);
  });
});
