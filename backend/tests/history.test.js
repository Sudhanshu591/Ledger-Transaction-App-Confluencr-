import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { setup } from './helpers.js';

describe('Transaction history', () => {
  let ctx;
  let accountId;

  before(async () => {
    ctx = await setup();
    accountId = (await ctx.createAccount()).id;
    // 7 credits then 5 debits, created in this order
    for (let i = 1; i <= 7; i++) await ctx.transact(accountId, 'credit', 10, { reference_id: `c${i}` });
    for (let i = 1; i <= 5; i++) await ctx.transact(accountId, 'debit', 1, { reference_id: `d${i}` });
  });
  after(() => ctx.close());

  const history = (query = '') => ctx.api.get(`/api/v1/accounts/${accountId}/transactions${query}`);

  test('returns all transactions latest-first with default pagination', async () => {
    const res = await history();
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 12);
    assert.deepEqual(
      res.body.data.map((t) => t.reference_id),
      ['d5', 'd4', 'd3', 'd2', 'd1', 'c7', 'c6', 'c5', 'c4', 'c3', 'c2', 'c1'],
    );
    assert.deepEqual(res.body.pagination, {
      page: 1,
      page_size: 20,
      total_records: 12,
      total_pages: 1,
      has_next: false,
      has_previous: false,
    });
  });

  test('filters by type', async () => {
    const credits = await history('?type=credit');
    assert.equal(credits.body.pagination.total_records, 7);
    assert.ok(credits.body.data.every((t) => t.type === 'credit'));

    const debits = await history('?type=debit');
    assert.equal(debits.body.pagination.total_records, 5);
    assert.ok(debits.body.data.every((t) => t.type === 'debit'));
  });

  test('paginates', async () => {
    const page2 = await history('?page=2&limit=5');
    assert.deepEqual(
      page2.body.data.map((t) => t.reference_id),
      ['c7', 'c6', 'c5', 'c4', 'c3'],
    );
    assert.deepEqual(page2.body.pagination, {
      page: 2,
      page_size: 5,
      total_records: 12,
      total_pages: 3,
      has_next: true,
      has_previous: true,
    });

    const filteredPage = await history('?type=credit&page=2&limit=5');
    assert.deepEqual(filteredPage.body.data.map((t) => t.reference_id), ['c2', 'c1']);

    const beyond = await history('?page=99&limit=5');
    assert.equal(beyond.status, 200);
    assert.deepEqual(beyond.body.data, []);
  });

  test('rejects invalid pagination and filter values', async () => {
    for (const q of ['?page=0', '?page=-1', '?page=abc', '?limit=0', '?limit=101', '?page=1.5']) {
      const res = await history(q);
      assert.equal(res.status, 400, q);
      assert.equal(res.body.error.code, 'INVALID_PAGINATION', q);
    }
    const badType = await history('?type=refund');
    assert.equal(badType.status, 400);
    assert.equal(badType.body.error.code, 'INVALID_TRANSACTION_TYPE');
  });

  test('returns 404 for an unknown account', async () => {
    const res = await ctx.api.get('/api/v1/accounts/00000000-0000-4000-8000-000000000000/transactions');
    assert.equal(res.status, 404);
  });
});
