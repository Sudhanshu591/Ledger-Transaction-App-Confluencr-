import { Router } from 'express';
import { methodNotAllowed } from '../middleware/errorHandler.js';
import { createTransaction, getTransaction } from '../services/transactions.js';
import { createTransactionSchema, parse, parseId } from '../validation.js';

const router = Router();
const immutable = methodNotAllowed('Transactions are immutable and cannot be modified or deleted.');

router
  .route('/')
  .post(async (req, res) => {
    const input = parse(createTransactionSchema, req.body);
    res.status(201).json(await createTransaction(req.app.locals.db, input));
  })
  .all(immutable);

router
  .route('/:transactionId')
  .get(async (req, res) => {
    const id = parseId(req.params.transactionId, 'INVALID_TRANSACTION_ID');
    res.json(await getTransaction(req.app.locals.db, id));
  })
  .all(immutable);

export default router;
