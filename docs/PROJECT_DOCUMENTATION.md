# Transaction Ledger: Project Documentation

*Post-development write-up for the Walnut Folks / Confluencr Full Stack Developer Assessment.*

| | |
| --- | --- |
| **Assignment** | Transaction Ledger API (plus bonus: money transfer) |
| **Delivered** | Backend API, PostgreSQL schema, React frontend, automated tests, documentation, deployment configs |
| **Stack** | Node.js · Express 5 · PostgreSQL (Supabase) · React 18 + Vite · Zod · node:test |
| **Status** | All functional requirements and the bonus implemented; 35/35 automated tests passing; deployed |
| **Live URLs** | App: https://ephemeral-scone-c3baf6.netlify.app · API: https://ledger-transaction-app-confluencr.onrender.com/api/v1 |

---

## 1. What was asked

The brief asked for a backend API for a simple ledger where users can:

1. **Create accounts** with a system-generated id and timestamp, and a balance that always starts at 0.
2. **Add credit/debit transactions**. Debits cannot overdraw, and a `reference_id` must be unique per account so the same transaction is never applied twice.
3. **Read the balance** of an account.
4. **Read transaction history** with type filtering, pagination and latest-first sorting.
5. Keep **data integrity**: transactions are immutable, the balance always equals the sum of valid transactions, and the "write transaction + update balance" step is atomic.
6. **Validate** all input and return **consistent, meaningful errors**.
7. *Bonus:* **transfer** money between accounts atomically.

The companion *Candidate Setup Guide* frames the live interview: a **small full-stack app** (backend API + frontend + database), a **Supabase** Postgres database, **deployment to AWS** (or Netlify + Render as a free fallback), and open use of **AI tools**. The candidate is responsible for every line and must be able to explain it. This project was built to fit that setup directly.

---

## 2. Architecture

```
┌──────────────────────┐   HTTPS/JSON   ┌───────────────────────────────┐   SQL (TLS)   ┌──────────────────┐
│  React dashboard     │ ─────────────► │  Express API                  │ ────────────► │  PostgreSQL      │
│  (Vite build)        │                │  routes → validation (Zod)    │               │  (Supabase)      │
│  accounts, forms,    │ ◄───────────── │        → services → db adapter │ ◄──────────── │  constraints,    │
│  history, transfers  │  {data}|{error}│  central error handler        │               │  trigger, RLS    │
└──────────────────────┘                └───────────────────────────────┘               └──────────────────┘
```

**Layering in the backend.** Each layer has one job:

| Layer | Files | Responsibility |
| ----- | ----- | -------------- |
| Routes | `src/routes/*.js` | Map HTTP to service calls; set status codes. No business logic. |
| Validation | `src/validation.js` | Zod schemas: types, ranges, required fields, unknown-field rejection, money normalization. |
| Services | `src/services/*.js` | Business rules, row locks, and DB transactions. |
| Data access | `src/db/index.js`, `schema.sql` | Two adapters (`pg` for Supabase, PGlite for local/tests) behind one `query` / `transaction` interface. |
| Errors | `src/errors.js`, `middleware/errorHandler.js` | Typed errors → `{ error: { code, message, details } }` with the correct HTTP status. |
| Mapping | `src/mappers.js` | DB rows → stable API JSON (numbers, ISO timestamps). |

**Why a database adapter?** Services depend on a two-method interface, not on a driver. That let the same service code run against Supabase in production and an embedded, in-process PostgreSQL (PGlite) in tests and local development. The project runs with no setup, and tests exercise the real SQL, constraints and triggers, not a mock.

---

## 3. Data model

```
accounts                         transfers                              transactions (append-only)
────────────────────────         ────────────────────────────           ─────────────────────────────────
id          UUID PK              id               UUID PK               id            UUID PK
name        VARCHAR(100) ✓trim   from_account_id  FK → accounts         seq           BIGINT identity (tie-break)
balance     NUMERIC(18,2) ≥ 0    to_account_id    FK → accounts         account_id    FK → accounts
created_at  TIMESTAMPTZ          amount           NUMERIC(18,2) > 0     type          'credit' | 'debit'
                                 description                            amount        NUMERIC(18,2) > 0
                                 reference_id                           description
                                 created_at                             reference_id
                                 UNIQUE(from_account_id, reference_id)  transfer_id   FK → transfers (nullable)
                                 CHECK(from ≠ to)                       created_at
                                                                        UNIQUE(account_id, reference_id)
                                                                        INDEX(account_id, created_at DESC, seq DESC)
```

The **stored balance** is a running total kept in step with the transaction log inside the same DB transaction. Reads are O(1), and the brief's rule "balance = result of all valid transactions" holds by construction (and is asserted by a test).

---

## 4. How each requirement is met

### 4.1 Create account
- `POST /accounts` accepts **only** `name`. The Zod schema is `.strict()`, so `{ "name": "x", "balance": 1000 }` is rejected with 400.
- `id` (`gen_random_uuid()`), `balance` (`DEFAULT 0`) and `created_at` (`clock_timestamp()`) are all set by the database.

### 4.2 Add transaction
Inside **one** DB transaction (`services/transactions.js`):

1. `SELECT … FOR UPDATE` locks the account row. Concurrent writes to the same account now queue behind each other.
2. Look up `(account_id, reference_id)`. If it exists, throw `409 DUPLICATE_TRANSACTION` and return the original.
3. Update the balance:
   - credit: `balance = balance + $amount`
   - debit: `balance = balance - $amount WHERE balance >= $amount`. If no row is updated, throw `422 INSUFFICIENT_BALANCE`.
4. Insert the transaction row.
5. `COMMIT`. Any throw at any step means `ROLLBACK`, so neither change persists.

### 4.3 Duplicate transactions
Three layers of defence:
- an application check (step 2 above), made race-free by the row lock;
- a `UNIQUE (account_id, reference_id)` constraint as the final arbiter;
- if the constraint fires anyway (error `23505`), the service turns it into the same 409 response.

The same `reference_id` on a different account is allowed, because the constraint is per account. A test fires 5 identical requests in parallel and asserts exactly one `201` and four `409`s, with the balance changed once.

### 4.4 Balance and history
- `GET /accounts/:id/balance` → `{ account_id, balance }`, or 404.
- `GET /accounts/:id/transactions?type=&page=&limit=` returns `ORDER BY created_at DESC, seq DESC` with `LIMIT/OFFSET`, a separate `COUNT(*)` for totals, and the metadata `page, page_size, total_records, total_pages, has_next, has_previous`. An index on `(account_id, created_at DESC, seq DESC)` serves this query directly.

### 4.5 Data integrity

| Rule | Application level | Database level |
| ---- | ----------------- | -------------- |
| Transactions immutable | No update/delete routes; PUT/PATCH/DELETE → 405 | `BEFORE UPDATE OR DELETE` trigger raises an error |
| No negative balance | Conditional debit `UPDATE` | `CHECK (balance >= 0)` |
| Positive amounts | Zod validation | `CHECK (amount > 0)` |
| Valid type | Zod enum | `CHECK (type IN ('credit','debit'))` |
| Unique reference per account | Lookup under row lock | `UNIQUE (account_id, reference_id)` |
| Referential integrity | Account existence check | Foreign keys, `ON DELETE RESTRICT` |
| Atomicity | `db.transaction()` wrapper | PostgreSQL transaction |
| Exact money | Amounts kept as strings in JS | `NUMERIC(18,2)` arithmetic |

The database rules mean the guarantees hold even for a buggy future endpoint or someone with direct SQL access. Tests verify the trigger and the CHECK constraint directly.

### 4.6 Validation and error handling
All errors share one envelope with a machine-readable `code` (full list in [API.md](API.md#error-format)). Each case the brief lists has its own code: `ACCOUNT_NOT_FOUND`, `INVALID_TRANSACTION_TYPE`, `INVALID_AMOUNT`, `INSUFFICIENT_BALANCE`, `DUPLICATE_TRANSACTION`, `INVALID_PAGINATION`, `INVALID_REQUEST_BODY` / `INVALID_JSON`. Unexpected errors are logged and return a generic `500 INTERNAL_ERROR` without leaking internals.

### 4.7 Bonus: transfers
`POST /transfers` runs inside one DB transaction:
1. Lock **both** accounts **in ascending id order**. Two opposite transfers (A→B and B→A) running at the same moment cannot deadlock.
2. Reject a duplicate `reference_id` for that source account (409).
3. Make a conditional debit on the source (422 if insufficient), then a credit on the destination.
4. Insert the transfer record and **two normal ledger transactions** linked by `transfer_id`.

A test injects a failure **after** the debit has run and asserts both balances are unchanged and no transfer row exists. This proves a partial transfer is impossible.

---

## 5. Frontend

A single-page React dashboard (`frontend/`) that exercises every endpoint:

- **Account stack**: one card per account (name only); the selected account is highlighted in green. Below the stack: the **selected account's balance** (the brief's "Get Account Balance"), masked until the eye button is pressed, the account count, and a **+** button to create an account. All accounts are loaded by following the API's pagination.
- **Search**: filters the stack by name. The count shows "2 of 3 accounts" while filtering, and if the search hides the selected account, the first match is selected so the page never shows a hidden account.
- **Credit / Debit / Transfer**: header buttons open a pop-up form with an auto-generated `reference_id`. It is editable, so you can deliberately resubmit one and see the duplicate rejection.
- **Balance trend**: a line chart of the selected account's running balance over its last 100 transactions, reconstructed from the history. Hover for the balance and transaction at each point.
- **Money movement**: money in, money out and net over the same transactions, how much of the money received has gone out, and a bar per recent transaction.
- **Quick transfer**: the same transfer form as a dashboard card. Pick another account by avatar, enter an amount, send. Success opens a confirmation pop-up with an animated tick.
- **Transactions**: history with All / Credits / Debits filter and pagination, latest first.
- **Feedback**: routine successes appear as a small notification that fades out. Errors from user actions open a centred pop-up with a plain-language explanation built from the API's error code and details (for example, the available balance vs the requested debit). Background refreshes do not pop up "can't reach the server", because the status indicator already shows it.
- **API status**: a live indicator polls `GET /health` every 30 s and shows Connected, Waking up… (slow free-tier cold start) or Offline.
- **Side panel**: the menu button opens a panel linking to the top of the page, the transactions and the transfer card.

In development, Vite proxies `/api` and `/health` to the backend, so no CORS setup is needed. In production, `VITE_API_URL` points at the deployed API.

---

## 6. Testing

`cd backend && npm test`: **35 tests, all passing**. They use Node's built-in runner and Supertest against a fresh in-memory PostgreSQL per suite.

| Suite | Covers |
| ----- | ------ |
| `accounts.test.js` | zero initial balance, unique ids, client balance rejected, name validation, malformed JSON, 404 vs 400 ids, unknown routes |
| `transactions.test.js` | credit/debit maths, insufficient balance leaves no trace, debit of the full balance, duplicate reference (sequential and concurrent), same reference on other accounts, every validation code, exact decimal maths (`0.1 + 0.2 = 0.3`), 405 on mutation, DB trigger blocks UPDATE/DELETE, DB CHECK blocks a negative balance, spec balance example (final 100) |
| `history.test.js` | latest-first order, type filter, pagination metadata, filter + pagination together, page past the end, invalid page/limit/type |
| `transfers.test.js` | spec example (A 100→70, B 50→80), insufficient funds, missing account, same account, duplicate reference, **rollback after mid-transfer failure**, entries appear in both histories |
| `cors.test.js` | `CORS_ORIGIN` values pasted with a trailing slash, quotes, spaces or capitals still match; the configured site is allowed and other origins are refused |

A manual end-to-end smoke test was also run against the real HTTP server (create → credit → duplicate → overdraw → transfer → balances → paginated history → health), with the expected status codes throughout.

**Against the deployed stack:**
- **Supabase:** schema, RLS, the immutability trigger and the conditional debit were checked inside a rolled-back transaction.
- **Render:** the live API passed health, read, validation and error-code checks (404, 400, 405) without writing data.
- **CORS:** verified to allow only the Netlify origin.

---

## 7. Interview setup guide: what it means for this project

| Guide item | What it means | How this project handles it |
| ---------- | ------------- | --------------------------- |
| *Small full-stack app (API + frontend + DB)* | You'll be asked to build or extend something end to end | `backend/` + `frontend/` + Postgres schema, all wired together |
| *Node.js 18+ or Go* | Pick one backend runtime | Node.js (works on 18+, developed on 24) |
| *Supabase (free Postgres)* | Have a hosted DB ready before the interview; free projects pause after 1 week idle | `DATABASE_URL` → Supabase session pooler; `npm run migrate`; RLS enabled so the public API key can't touch the tables. Open the project on the morning of the interview. |
| *Supabase MCP (optional)* | Lets an AI tool run SQL on your project | Only on this test project, read-only if possible, and review each SQL statement before approving. Skip it if it isn't working within 10 minutes. |
| *AWS account (free plan)* | Deploy target; verification can take time | App Runner / Beanstalk / EC2 for the API, S3+CloudFront or Amplify for the UI ([DEPLOYMENT.md](DEPLOYMENT.md)). Enable MFA, set a budget alert, use an IAM user. If AWS isn't ready, describe this design on paper. |
| *Netlify + Render fallback* | Free hosting if AWS isn't ready | `netlify.toml` and `render.yaml` included. Render sleeps after 15 min, so warm it up 5 min before; Render's disk is wiped, so data lives in Supabase. |
| *AI tools allowed* | They assess *decisions* and how you verify AI output | See section 8 |
| *Quick self-test* | DB reachable from code, AI tool works, AWS console login | `GET /health` runs `SELECT 1` against the configured DB |

---

## 8. Use of AI and how it was verified

AI assistance was used to scaffold code and documentation. The guide's rule is "*you are responsible for every line you submit*", so every piece was checked:

- **Correctness checked by tests, not by eye.** Each brief rule maps to at least one test (section 6), including the hard cases: concurrent duplicates, rollback mid-transfer, and DB-level immutability.
- **Concurrency reasoned through, not assumed.** The row lock + conditional `UPDATE` + unique constraint combination covers the races: two debits racing, two identical references racing, A→B and B→A transfers racing (fixed lock order).
- **Money handling.** Floats are a common source of bugs in AI-generated money code, so amounts deliberately stay strings in JS and use `NUMERIC` in Postgres. The `0.1 + 0.2` test guards this.
- **SQL reviewed before running.** Every statement is parameterised (`$1, $2…`); no string interpolation of user input.
- **Security defaults.** Unknown body fields rejected, body size limit, RLS on Supabase tables, no stack traces in responses, configurable CORS origin.

---

## 9. Known limitations and next steps

| Limitation | Production approach |
| ---------- | ------------------- |
| No authentication/authorisation | JWT / Supabase Auth; scope accounts to their owner |
| Offset pagination slows on very deep pages | Keyset (cursor) pagination on `(created_at, seq)` |
| Single currency | `currency` column on accounts; reject cross-currency transfers or add FX |
| Duplicate returns 409 even for an identical retry | Optionally return `200` with the original when the payload matches exactly (true idempotent replay) |
| No rate limiting / request IDs | `express-rate-limit`, a correlation-id middleware, structured logging (pino) |
| No CI | GitHub Actions running `npm test` and `npm run build` on every push |

---

## 10. Running it

See the [README](../README.md) for full commands. In short:

```bash
cd backend  && npm install && npm run dev    # API on :4000 (embedded Postgres, zero setup)
cd frontend && npm install && npm run dev    # UI on :5173
cd backend  && npm test                      # 35 tests
```
