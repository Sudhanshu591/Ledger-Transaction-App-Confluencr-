import request from 'supertest';
import { createApp } from '../src/app.js';
import { createPgliteDatabase, migrate } from '../src/db/index.js';

/** Fresh in-memory Postgres + app per call, so tests never share state. */
export async function setup() {
  const db = await createPgliteDatabase();
  await migrate(db);
  const app = createApp({ db });
  const api = request(app);

  const createAccount = async (name = 'Alice') => (await api.post('/api/v1/accounts').send({ name })).body;

  let refCounter = 0;
  const transact = (accountId, type, amount, extra = {}) =>
    api.post('/api/v1/transactions').send({
      account_id: accountId,
      type,
      amount,
      reference_id: extra.reference_id ?? `ref-${++refCounter}`,
      description: extra.description,
    });

  const balanceOf = async (accountId) => (await api.get(`/api/v1/accounts/${accountId}/balance`)).body.balance;

  return { db, api, createAccount, transact, balanceOf, close: () => db.close() };
}
