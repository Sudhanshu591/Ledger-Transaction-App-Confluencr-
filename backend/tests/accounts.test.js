import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { setup } from './helpers.js';

describe('Accounts', () => {
  let ctx;
  before(async () => (ctx = await setup()));
  after(() => ctx.close());

  test('creates an account with zero balance and system-generated fields', async () => {
    const res = await ctx.api.post('/api/v1/accounts').send({ name: '  Alice  ' });
    assert.equal(res.status, 201);
    assert.equal(res.body.name, 'Alice');
    assert.equal(res.body.balance, 0);
    assert.match(res.body.id, /^[0-9a-f-]{36}$/);
    assert.ok(!Number.isNaN(Date.parse(res.body.created_at)));
  });

  test('ids are unique', async () => {
    const a = await ctx.createAccount('A');
    const b = await ctx.createAccount('B');
    assert.notEqual(a.id, b.id);
  });

  test('rejects a client-provided balance', async () => {
    const res = await ctx.api.post('/api/v1/accounts').send({ name: 'Mallory', balance: 1000 });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  test('requires a name', async () => {
    for (const body of [{}, { name: '' }, { name: '   ' }, { name: 42 }]) {
      const res = await ctx.api.post('/api/v1/accounts').send(body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    }
  });

  test('rejects malformed JSON and non-object bodies', async () => {
    const bad = await ctx.api.post('/api/v1/accounts').set('Content-Type', 'application/json').send('{"name":');
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error.code, 'INVALID_JSON');

    const arr = await ctx.api.post('/api/v1/accounts').send([{ name: 'x' }]);
    assert.equal(arr.status, 400);
    assert.equal(arr.body.error.code, 'INVALID_REQUEST_BODY');
  });

  test('returns balance, and 404 / 400 for unknown / malformed ids', async () => {
    const acc = await ctx.createAccount();
    const ok = await ctx.api.get(`/api/v1/accounts/${acc.id}/balance`);
    assert.deepEqual(ok.body, { account_id: acc.id, balance: 0 });

    const missing = await ctx.api.get('/api/v1/accounts/00000000-0000-4000-8000-000000000000/balance');
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error.code, 'ACCOUNT_NOT_FOUND');

    const malformed = await ctx.api.get('/api/v1/accounts/not-a-uuid/balance');
    assert.equal(malformed.status, 400);
    assert.equal(malformed.body.error.code, 'INVALID_ACCOUNT_ID');
  });

  test('unknown routes return the standard error shape', async () => {
    const res = await ctx.api.get('/api/v1/nope');
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'ROUTE_NOT_FOUND');
  });
});
