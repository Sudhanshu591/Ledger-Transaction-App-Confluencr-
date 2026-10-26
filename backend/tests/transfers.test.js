import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { createTransfer } from '../src/services/transfers.js';
import { setup } from './helpers.js';

describe('Transfers', () => {
  let ctx;
  before(async () => (ctx = await setup()));
  after(() => ctx.close());

  async function fundedPair(a = 100, b = 50) {
    const A = await ctx.createAccount('A');
    const B = await ctx.createAccount('B');
    if (a) await ctx.transact(A.id, 'credit', a);
    if (b) await ctx.transact(B.id, 'credit', b);
    return [A.id, B.id];
  }

  const transfer = (from, to, amount, reference_id = `t-${Math.random()}`) =>
    ctx.api.post('/api/v1/transfers').send({ from_account_id: from, to_account_id: to, amount, reference_id });

  test('moves money and records a debit and a credit (spec example)', async () => {
    const [a, b] = await fundedPair(100, 50);
    const res = await transfer(a, b, 30);
    assert.equal(res.status, 201);
    assert.equal(await ctx.balanceOf(a), 70);
    assert.equal(await ctx.balanceOf(b), 80);
    assert.equal(res.body.debit_transaction.account_id, a);
    assert.equal(res.body.credit_transaction.account_id, b);
    assert.equal(res.body.debit_transaction.transfer_id, res.body.id);

    const fetched = await ctx.api.get(`/api/v1/transfers/${res.body.id}`);
    assert.deepEqual(fetched.body, res.body);
  });

  test('insufficient balance rejects the whole transfer', async () => {
    const [a, b] = await fundedPair(10, 0);
    const res = await transfer(a, b, 30);
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'INSUFFICIENT_BALANCE');
    assert.equal(await ctx.balanceOf(a), 10);
    assert.equal(await ctx.balanceOf(b), 0);
  });

  test('both accounts must exist', async () => {
    const [a] = await fundedPair();
    const res = await transfer(a, '00000000-0000-4000-8000-000000000000', 5);
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'ACCOUNT_NOT_FOUND');
    assert.equal(await ctx.balanceOf(a), 100);
  });

  test('cannot transfer to the same account', async () => {
    const [a] = await fundedPair();
    const res = await transfer(a, a, 5);
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'SAME_ACCOUNT_TRANSFER');
  });

  test('duplicate reference_id from the same source returns 409', async () => {
    const [a, b] = await fundedPair();
    assert.equal((await transfer(a, b, 5, 'T-1')).status, 201);
    const dup = await transfer(a, b, 5, 'T-1');
    assert.equal(dup.status, 409);
    assert.equal(dup.body.error.code, 'DUPLICATE_TRANSFER');
    assert.equal(await ctx.balanceOf(a), 95);
  });

  test('a failure after the debit rolls the whole transfer back', async () => {
    const [a, b] = await fundedPair(100, 50);
    // Wrap the DB so the credit leg's insert fails mid-transfer.
    const faultyDb = {
      ...ctx.db,
      transaction: (fn) =>
        ctx.db.transaction((tx) =>
          fn({
            query: (sql, params) =>
              sql.includes('INSERT INTO transactions') && params[1] === 'credit'
                ? Promise.reject(new Error('simulated crash'))
                : tx.query(sql, params),
          }),
        ),
    };
    await assert.rejects(
      createTransfer(faultyDb, { from_account_id: a, to_account_id: b, amount: '30.00', reference_id: 'X', description: null }),
      /simulated crash/,
    );
    assert.equal(await ctx.balanceOf(a), 100);
    assert.equal(await ctx.balanceOf(b), 50);
    const { rows } = await ctx.db.query('SELECT count(*)::int AS n FROM transfers WHERE reference_id = $1', ['X']);
    assert.equal(rows[0].n, 0);
  });

  test('transfer history entries appear in both accounts', async () => {
    const [a, b] = await fundedPair();
    await transfer(a, b, 25);
    const aHist = (await ctx.api.get(`/api/v1/accounts/${a}/transactions?type=debit`)).body.data;
    const bHist = (await ctx.api.get(`/api/v1/accounts/${b}/transactions`)).body.data;
    assert.equal(aHist[0].amount, 25);
    assert.equal(bHist[0].type, 'credit');
    assert.equal(bHist[0].amount, 25);
  });
});
