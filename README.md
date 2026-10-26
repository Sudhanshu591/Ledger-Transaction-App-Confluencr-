# Transaction Ledger

A full-stack transaction ledger: a REST API for accounts, credit/debit transactions, balances, paginated history and atomic money transfers, plus a React dashboard to drive it.

## Live demo

| | URL |
| --- | --- |
| **App** | https://ephemeral-scone-c3baf6.netlify.app |
| **API** | https://ledger-transaction-app-confluencr.onrender.com/api/v1 |
| **Health** | https://ledger-transaction-app-confluencr.onrender.com/health |

The API runs on Render's free plan and sleeps after 15 minutes idle. The first request can take up to a minute; the app's status indicator shows "Waking up…" until it is ready.

## Submission

| Required | Where |
| -------- | ----- |
| 1. Source code | This repository: [`backend/`](backend), [`frontend/`](frontend) |
| 2. README | This file |
| 3. API documentation | [docs/API.md](docs/API.md) |
| 4. Assumptions | [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md) |

Also included: [docs/PROJECT_DOCUMENTATION.md](docs/PROJECT_DOCUMENTATION.md) (architecture, how each requirement is met, testing, use of AI) and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) (Supabase, Render, Netlify and AWS steps).

## Tech stack

| Layer     | Technology                                                       |
| --------- | ---------------------------------------------------------------- |
| Backend   | Node.js 18+ · Express 5 · Zod (validation) · `pg`                |
| Database  | PostgreSQL: Supabase in production; embedded PGlite for local dev and tests |
| Frontend  | React 18 · Vite 6                                                |
| Tests     | `node:test` · Supertest, run against a real Postgres engine (PGlite) |
| Hosting   | Render (API) · Netlify (UI) · Supabase (database). AWS alternative in [DEPLOYMENT.md](docs/DEPLOYMENT.md) |

## Quick start (no database setup needed)

Requires **Node.js 18 or newer**.

```bash
# 1. Backend (http://localhost:4000)
cd backend
npm install
npm run dev          # uses the embedded Postgres (PGlite) in ./.data/ledger

# 2. Frontend (http://localhost:5173), in a second terminal
cd frontend
npm install
npm run dev
```

Open http://localhost:5173, create two accounts, add credits/debits and try a transfer.

### Using Supabase (or any PostgreSQL)

Create `backend/.env` (it is git-ignored, so it never leaves your machine):

```bash
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
DATABASE_SSL=true
```

Then:

```bash
cd backend
npm run migrate              # optional: the server also applies the schema on startup
npm start
```

### Environment variables

No configuration is needed for local development. All variables are optional.

| Where | Variable | Default | Purpose |
| ----- | -------- | ------- | ------- |
| backend | `PORT` | `4000` | Port the API listens on |
| backend | `DATABASE_URL` | *(empty)* | PostgreSQL connection string (Supabase **Session pooler**). Empty = embedded PGlite |
| backend | `DATABASE_SSL` | `false` | `true` for Supabase / any hosted Postgres that requires TLS |
| backend | `PGLITE_DATA_DIR` | `./.data/ledger` | Where the embedded database stores its files |
| backend | `CORS_ORIGIN` | `*` | Allowed frontend origin(s), comma-separated, e.g. `https://your-site.netlify.app` |
| frontend | `VITE_API_URL` | *(empty)* | Backend base URL for production builds. Empty = Vite dev proxy to `localhost:4000` |

## Tests

```bash
cd backend
npm test
```

35 tests cover account creation, credit/debit rules, insufficient balance, duplicate `reference_id` (including concurrent duplicates), validation and error codes, history filtering, pagination and ordering, transaction immutability (API and database level), balance consistency, transfers including rollback after a mid-transfer failure, and CORS configuration.

## API at a glance

Base path: `/api/v1`

| Method | Path | Purpose |
| ------ | ---- | ------- |
| POST | `/accounts` | Create account (`{ "name": "Alice" }`) |
| GET  | `/accounts` | List accounts (paginated) |
| GET  | `/accounts/:id` | Account details |
| GET  | `/accounts/:id/balance` | `{ account_id, balance }` |
| GET  | `/accounts/:id/transactions?type=&page=&limit=` | History, latest first |
| POST | `/transactions` | Credit or debit |
| GET  | `/transactions/:id` | Single transaction |
| POST | `/transfers` | Bonus: atomic transfer between accounts |
| GET  | `/transfers/:id` | Transfer with its two ledger entries |
| GET  | `/health` | Liveness + DB check |

Errors always look like `{ "error": { "code": "INSUFFICIENT_BALANCE", "message": "...", "details": { ... } } }`.

## Project structure

```
backend/
  src/
    app.js                 Express app factory (routes, middleware)
    server.js              Entry point: picks DB, runs migrations, listens
    migrate.js             `npm run migrate` against DATABASE_URL
    config.js              Environment configuration
    validation.js          Zod schemas for every request
    errors.js              Typed application errors -> HTTP status + code
    mappers.js             DB rows -> API JSON
    db/schema.sql          Tables, constraints, immutability trigger, RLS
    db/index.js            pg / PGlite adapters with one transaction() interface
    routes/                HTTP layer (thin)
    services/              Business rules and DB transactions
    middleware/errorHandler.js
  tests/                   API tests against a real Postgres engine
frontend/
  src/App.jsx, components/ React dashboard
  src/api.js               Fetch client with typed errors
docs/                      API reference, assumptions, write-up, deployment
render.yaml, netlify.toml  Hosting configs
```
