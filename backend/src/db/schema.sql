-- Transaction Ledger schema (PostgreSQL / Supabase).
-- Idempotent: safe to run on every startup.

CREATE TABLE IF NOT EXISTS accounts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100)  NOT NULL CHECK (length(btrim(name)) > 0),
  balance     NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS transfers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_account_id  UUID          NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  to_account_id    UUID          NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  amount           NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  description      VARCHAR(255),
  reference_id     VARCHAR(100)  NOT NULL,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_transfers_distinct_accounts CHECK (from_account_id <> to_account_id),
  CONSTRAINT uq_transfers_from_reference UNIQUE (from_account_id, reference_id)
);

CREATE TABLE IF NOT EXISTS transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Monotonic insert order; breaks ties when two rows share created_at.
  seq           BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
  account_id    UUID          NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  type          VARCHAR(6)    NOT NULL CHECK (type IN ('credit', 'debit')),
  amount        NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  description   VARCHAR(255),
  reference_id  VARCHAR(100)  NOT NULL,
  transfer_id   UUID REFERENCES transfers(id) ON DELETE RESTRICT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_transactions_account_reference UNIQUE (account_id, reference_id)
);

CREATE INDEX IF NOT EXISTS idx_transactions_account_history
  ON transactions (account_id, created_at DESC, seq DESC);

-- Transactions are append-only: block UPDATE and DELETE at the database level,
-- so immutability holds even for clients that bypass the API.
CREATE OR REPLACE FUNCTION prevent_transaction_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'transactions are immutable (% is not allowed)', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_transactions_immutable ON transactions;
CREATE TRIGGER trg_transactions_immutable
  BEFORE UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION prevent_transaction_mutation();

-- Supabase exposes public tables through its auto-generated REST API.
-- RLS with no policies denies that path; the backend connects as the table owner.
ALTER TABLE accounts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
