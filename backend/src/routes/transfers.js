import { Router } from 'express';
import { methodNotAllowed } from '../middleware/errorHandler.js';
import { createTransfer, getTransfer } from '../services/transfers.js';
import { createTransferSchema, parse, parseId } from '../validation.js';

const router = Router();
const immutable = methodNotAllowed('Transfers are immutable and cannot be modified or deleted.');

router
  .route('/')
  .post(async (req, res) => {
    const input = parse(createTransferSchema, req.body);
    res.status(201).json(await createTransfer(req.app.locals.db, input));
  })
  .all(immutable);

router
  .route('/:transferId')
  .get(async (req, res) => {
    const id = parseId(req.params.transferId, 'INVALID_TRANSFER_ID');
    res.json(await getTransfer(req.app.locals.db, id));
  })
  .all(immutable);

export default router;
