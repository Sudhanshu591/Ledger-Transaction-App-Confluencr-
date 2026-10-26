# Assumptions

These are the decisions taken where the brief left room for interpretation.

## Accounts
1. **Single currency.** There is no currency field. All amounts are in one implied currency.
2. **The client can only send `name`.** Any other field (including `balance`) is rejected with `400` rather than silently ignored, so a client that tries to set a balance gets a clear signal.
3. **Names are not unique.** Two people can share a name; `id` is the identity. Names are trimmed and must be 1–100 characters.
4. **Accounts cannot be deleted or renamed.** That is not in scope. Foreign keys use `ON DELETE RESTRICT`, so an account with history can never be removed accidentally.
5. **An account list endpoint (`GET /accounts`) was added** because the frontend needs it. It is not in the brief.

## Money
6. **Amounts have at most 2 decimal places** and must be `> 0` and `≤ 1,000,000,000,000` per operation. Inputs like `12.345` are rejected, not rounded.
7. **Amounts are exact.** They are stored as `NUMERIC(18,2)` and all arithmetic happens in Postgres. JavaScript floats never touch a balance calculation. Responses return amounts as JSON numbers, which is safe for 2-decimal values in this range.
8. **Balances cannot go negative.** There are no overdrafts. A debit equal to the full balance is allowed.

## Transactions
9. **`reference_id` is an idempotency key scoped to the account.** A repeat with the same `reference_id` returns `409 DUPLICATE_TRANSACTION`, even if the amount or type differs, and includes the original transaction so the client can reconcile. 409 was chosen over replying `200` with the original so the client always knows the request did not create anything new.
10. **A rejected transaction is not stored.** Insufficient-balance and validation failures leave no row, so a `reference_id` used by a rejected request can be retried.
11. **The duplicate check runs before the balance check.** A repeated `reference_id` returns 409 even if the repeat would also have failed for insufficient balance, because "already exists" is the more useful answer.
12. **`description` is optional**, up to 255 characters, and stored as `null` when empty.
13. **Ordering ties.** History is sorted by `created_at DESC`. Rows with the same timestamp are ordered by an internal insert sequence, so pagination is stable.
14. **A page past the end returns an empty list (200)**, not an error. `page < 1`, non-integer values, or `limit` outside 1–100 return `400 INVALID_PAGINATION`.

## Error codes
15. Request validation errors use **400**. Business-rule rejections on well-formed requests (insufficient balance, same-account transfer) use **422**. Duplicates use **409**. Malformed UUIDs in the path return **400**; well-formed but unknown IDs return **404**.

## Transfers (bonus)
16. A transfer creates **one transfer record and two ordinary ledger transactions** (a debit on the source, a credit on the destination) linked by `transfer_id`. Both show up in each account's normal history, and the balance-equals-sum-of-transactions rule still holds per account.
17. **The transfer `reference_id` is unique per source account**, in its own namespace separate from transaction reference IDs. The ledger entries get system-generated references (`transfer:<id>:out` / `:in`), so they can never collide with client references.
18. If no description is given, the entries default to "Transfer to <name>" / "Transfer from <name>".

## Infrastructure
19. **No authentication.** The brief does not ask for it. In production every route would sit behind auth, and account access would be scoped to the owner.
20. **Local development uses PGlite**, a real PostgreSQL engine compiled to WebAssembly, so the project runs with `npm install && npm run dev` and no database setup. Production uses Supabase PostgreSQL through `DATABASE_URL`. The same `schema.sql` runs on both.
21. **Supabase's auto-generated REST API is locked down.** Row Level Security is enabled with no policies, so the public `anon` key cannot read or write ledger tables. Only the backend, connecting as the database owner, can.
