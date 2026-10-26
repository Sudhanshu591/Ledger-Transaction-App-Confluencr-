import { Router } from 'express';
import { createAccount, getAccount, getBalance, listAccounts } from '../services/accounts.js';
import { listTransactions } from '../services/transactions.js';
import { createAccountSchema, historyQuerySchema, paginationSchema, parse, parseId } from '../validation.js';

const router = Router();
const accountId = (req) => parseId(req.params.accountId, 'INVALID_ACCOUNT_ID');

router.post('/', async (req, res) => {
  const input = parse(createAccountSchema, req.body);
  res.status(201).json(await createAccount(req.app.locals.db, input));
});

router.get('/', async (req, res) => {
  res.json(await listAccounts(req.app.locals.db, parse(paginationSchema, req.query)));
});

router.get('/:accountId', async (req, res) => {
  res.json(await getAccount(req.app.locals.db, accountId(req)));
});

router.get('/:accountId/balance', async (req, res) => {
  res.json(await getBalance(req.app.locals.db, accountId(req)));
});

router.get('/:accountId/transactions', async (req, res) => {
  const id = accountId(req);
  res.json(await listTransactions(req.app.locals.db, id, parse(historyQuerySchema, req.query)));
});

export default router;
