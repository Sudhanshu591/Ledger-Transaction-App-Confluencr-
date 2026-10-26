# Transaction Ledger

A full-stack transaction ledger: a REST API for accounts, credit/debit transactions, balances, paginated history and atomic money transfers, plus a React dashboard to drive it.

| Layer     | Technology                                                       |
| --------- | ---------------------------------------------------------------- |
| Backend   | Node.js 18+ · Express 5 · Zod (validation) · `pg`                |
| Database  | PostgreSQL. Supabase in production; embedded PGlite for local dev/tests |
| Frontend  | React 18 · Vite 6                                                |
| Tests     | `node:test` · Supertest, run against a real Postgres engine (PGlite) |
| Hosting   | AWS (App Runner / EC2 + S3/CloudFront), or Render (API) + Netlify (UI) |

## Documentation

| Document | Contents |
| -------- | -------- |
| [docs/API.md](docs/API.md) | Every endpoint, request/response examples, error codes |
| [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md) | Decisions made where the brief was open |
| [docs/PROJECT_DOCUMENTATION.md](docs/PROJECT_DOCUMENTATION.md) | Post-development write-up: architecture, how each requirement is met, testing, use of AI |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Supabase, Render, Netlify and AWS deployment steps |

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

```bash
cd backend
cp .env.example .env         # Windows: copy .env.example .env
# set DATABASE_URL to the Supabase "Session pooler" connection string and DATABASE_SSL=true
npm run migrate              # optional: the server also applies the schema on startup
npm start
```

## Tests

```bash
cd backend
npm test
```

32 tests cover account creation, credit/debit rules, insufficient balance, duplicate `reference_id` (including concurrent duplicates), validation and error codes, history filtering, pagination and ordering, transaction immutability (API and database level), balance consistency, and transfers including rollback after a mid-transfer failure.

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
