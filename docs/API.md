# API Reference

Base URL (local): `http://localhost:4000/api/v1`
All requests and responses are JSON. Timestamps are ISO-8601 UTC. IDs are UUIDs.
Amounts are JSON numbers with at most 2 decimal places (numeric strings such as `"50.00"` are also accepted on input).

---

## Error format

Every error response has the same shape:

```json
{
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Insufficient balance to complete this debit.",
    "details": { "account_id": "…", "balance": 100, "requested_amount": 150 }
  }
}
```

| HTTP | `code` | When |
| ---- | ------ | ---- |
| 400 | `VALIDATION_ERROR` | One or more fields invalid (see `details.errors[]` → `{ field, message }`) |
| 400 | `INVALID_TRANSACTION_TYPE` | `type` is not `credit` or `debit` (body or query) |
| 400 | `INVALID_AMOUNT` | Amount missing, not a number, ≤ 0, more than 2 decimals, or above 1,000,000,000,000 |
| 400 | `INVALID_PAGINATION` | `page` / `limit` not a positive integer, or `limit` > 100 |
| 400 | `INVALID_ACCOUNT_ID` / `INVALID_TRANSACTION_ID` / `INVALID_TRANSFER_ID` | ID is not a valid UUID |
| 400 | `INVALID_JSON` | Body is not parseable JSON |
| 400 | `INVALID_REQUEST_BODY` | Body missing or not a JSON object |
| 404 | `ACCOUNT_NOT_FOUND` / `TRANSACTION_NOT_FOUND` / `TRANSFER_NOT_FOUND` | Valid ID, no such record |
| 404 | `ROUTE_NOT_FOUND` | Unknown endpoint |
| 405 | `METHOD_NOT_ALLOWED` | PUT/PATCH/DELETE on transactions or transfers (they are immutable) |
| 409 | `DUPLICATE_TRANSACTION` | `reference_id` already used on this account. `details.existing_transaction` holds the original |
| 409 | `DUPLICATE_TRANSFER` | `reference_id` already used for a transfer from this source account |
| 422 | `INSUFFICIENT_BALANCE` | Debit/transfer larger than the current balance |
| 422 | `SAME_ACCOUNT_TRANSFER` | `from_account_id` equals `to_account_id` |
| 422 | `AMOUNT_OUT_OF_RANGE` | Resulting balance would exceed NUMERIC(18,2) |
| 500 | `INTERNAL_ERROR` | Unexpected failure (logged server-side; nothing is persisted) |

---

## Accounts

### Create account
`POST /accounts`

```json
{ "name": "Alice" }
```

Only `name` is accepted (1–100 chars, trimmed). Sending `balance`, `id` or any other field returns `400 VALIDATION_ERROR`, so a client can never set the initial balance.

**201 Created**
```json
{
  "id": "67f421c5-3079-46bf-a149-dc134562ebb0",
  "name": "Alice",
  "balance": 0,
  "created_at": "2026-10-26T13:19:24.787Z"
}
```

### List accounts
`GET /accounts?page=1&limit=20` → paginated envelope (see *Pagination* below), newest first.

### Get account
`GET /accounts/{account_id}` → the account object. `404 ACCOUNT_NOT_FOUND` if missing.

### Get balance
`GET /accounts/{account_id}/balance`

**200 OK**
```json
{ "account_id": "67f421c5-3079-46bf-a149-dc134562ebb0", "balance": 70 }
```

---

## Transactions

### Add transaction
`POST /transactions`

| Field | Type | Rules |
| ----- | ---- | ----- |
| `account_id` | UUID | required, account must exist |
| `type` | string | `credit` or `debit` |
| `amount` | number | > 0, max 2 decimals, ≤ 1,000,000,000,000 |
| `reference_id` | string | required, 1–100 chars, unique per account |
| `description` | string | optional, ≤ 255 chars |

```json
{
  "account_id": "67f421c5-3079-46bf-a149-dc134562ebb0",
  "type": "credit",
  "amount": 100,
  "reference_id": "INV-1001",
  "description": "Opening deposit"
}
```

**201 Created**
```json
{
  "id": "5a4187e8-6679-4270-8808-5481ad2811a1",
  "account_id": "67f421c5-3079-46bf-a149-dc134562ebb0",
  "type": "credit",
  "amount": 100,
  "description": "Opening deposit",
  "reference_id": "INV-1001",
  "transfer_id": null,
  "created_at": "2026-10-26T13:19:24.890Z"
}
```

Behaviour:
- **credit** adds `amount` to the balance; **debit** subtracts it.
- A debit larger than the balance → `422 INSUFFICIENT_BALANCE`; nothing is written.
- The same `reference_id` again on the same account → `409 DUPLICATE_TRANSACTION`, with the original under `details.existing_transaction`. No new row, balance unchanged. The same `reference_id` on a **different** account is allowed.

### Get transaction
`GET /transactions/{transaction_id}` → the transaction object.

`PUT`, `PATCH` and `DELETE` on `/transactions/{id}` return `405 METHOD_NOT_ALLOWED`.

### Transaction history
`GET /accounts/{account_id}/transactions`

| Query | Default | Rules |
| ----- | ------- | ----- |
| `type` | (both) | `credit` or `debit` |
| `page` | 1 | integer ≥ 1 |
| `limit` | 20 | integer 1–100 |

Sorted by `created_at` descending (latest first). A page beyond the last returns an empty `data` array.

**200 OK**
```json
{
  "data": [ { "id": "…", "type": "debit", "amount": 30, "…": "…" } ],
  "pagination": {
    "page": 2,
    "page_size": 5,
    "total_records": 12,
    "total_pages": 3,
    "has_next": true,
    "has_previous": true
  }
}
```

---

## Transfers (bonus)

### Create transfer
`POST /transfers`

```json
{
  "from_account_id": "67f421c5-…",
  "to_account_id": "51e77187-…",
  "amount": 30,
  "reference_id": "TRF-001",
  "description": "Rent share"
}
```

**201 Created**
```json
{
  "id": "a14c0104-9063-4285-b788-0b7cad81a19d",
  "from_account_id": "67f421c5-…",
  "to_account_id": "51e77187-…",
  "amount": 30,
  "description": "Rent share",
  "reference_id": "TRF-001",
  "created_at": "…",
  "debit_transaction":  { "type": "debit",  "account_id": "67f421c5-…", "reference_id": "transfer:a14c…:out", "transfer_id": "a14c…", "…": "…" },
  "credit_transaction": { "type": "credit", "account_id": "51e77187-…", "reference_id": "transfer:a14c…:in",  "transfer_id": "a14c…", "…": "…" }
}
```

Debit, credit, the transfer record and both ledger entries are written in **one database transaction**. Any failure rolls all of it back.
Errors: `404 ACCOUNT_NOT_FOUND`, `422 INSUFFICIENT_BALANCE`, `422 SAME_ACCOUNT_TRANSFER`, `409 DUPLICATE_TRANSFER`.

### Get transfer
`GET /transfers/{transfer_id}` → the same shape as the create response.

---

## Health
`GET /health` → `{ "status": "ok" }` (also runs `SELECT 1` against the database).

## Example session (curl)

```bash
API=http://localhost:4000/api/v1
A=$(curl -s -X POST $API/accounts -H 'Content-Type: application/json' -d '{"name":"Alice"}' | jq -r .id)
curl -s -X POST $API/transactions -H 'Content-Type: application/json' \
  -d "{\"account_id\":\"$A\",\"type\":\"credit\",\"amount\":100,\"reference_id\":\"r1\"}"
curl -s $API/accounts/$A/balance
curl -s "$API/accounts/$A/transactions?type=credit&page=1&limit=10"
```
