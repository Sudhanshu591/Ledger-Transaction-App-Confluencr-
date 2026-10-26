import cors from 'cors';
import express from 'express';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import accountsRouter from './routes/accounts.js';
import transactionsRouter from './routes/transactions.js';
import transfersRouter from './routes/transfers.js';

export function createApp({ db, corsOrigin = '*' }) {
  const app = express();
  app.locals.db = db;

  app.disable('x-powered-by');
  app.use(cors({ origin: corsOrigin === '*' ? '*' : corsOrigin.split(',').map((o) => o.trim()) }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', async (req, res) => {
    await db.query('SELECT 1');
    res.json({ status: 'ok' });
  });

  app.use('/api/v1/accounts', accountsRouter);
  app.use('/api/v1/transactions', transactionsRouter);
  app.use('/api/v1/transfers', transfersRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
