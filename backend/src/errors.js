export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class AccountNotFoundError extends AppError {
  constructor(accountId) {
    super(404, 'ACCOUNT_NOT_FOUND', `Account '${accountId}' does not exist.`, { account_id: accountId });
  }
}

export class TransactionNotFoundError extends AppError {
  constructor(transactionId) {
    super(404, 'TRANSACTION_NOT_FOUND', `Transaction '${transactionId}' does not exist.`, {
      transaction_id: transactionId,
    });
  }
}

export class TransferNotFoundError extends AppError {
  constructor(transferId) {
    super(404, 'TRANSFER_NOT_FOUND', `Transfer '${transferId}' does not exist.`, { transfer_id: transferId });
  }
}

export class DuplicateTransactionError extends AppError {
  constructor(existing) {
    super(
      409,
      'DUPLICATE_TRANSACTION',
      `A transaction with reference_id '${existing.reference_id}' already exists for this account.`,
      { existing_transaction: existing },
    );
  }
}

export class DuplicateTransferError extends AppError {
  constructor(existing) {
    super(
      409,
      'DUPLICATE_TRANSFER',
      `A transfer with reference_id '${existing.reference_id}' already exists for the source account.`,
      { existing_transfer: existing },
    );
  }
}

export class InsufficientBalanceError extends AppError {
  constructor({ accountId, balance, requested }) {
    super(422, 'INSUFFICIENT_BALANCE', 'Insufficient balance to complete this debit.', {
      account_id: accountId,
      balance,
      requested_amount: requested,
    });
  }
}

export class SameAccountTransferError extends AppError {
  constructor() {
    super(422, 'SAME_ACCOUNT_TRANSFER', 'Source and destination accounts must be different.');
  }
}

// Picks a specific error code when every issue concerns the same well-known field.
const FIELD_CODES = {
  type: 'INVALID_TRANSACTION_TYPE',
  amount: 'INVALID_AMOUNT',
  page: 'INVALID_PAGINATION',
  limit: 'INVALID_PAGINATION',
  account_id: 'INVALID_ACCOUNT_ID',
  from_account_id: 'INVALID_ACCOUNT_ID',
  to_account_id: 'INVALID_ACCOUNT_ID',
};

export class ValidationError extends AppError {
  constructor(zodError) {
    const issues = zodError.issues.map((issue) => ({
      field: issue.path.length ? issue.path.join('.') : (issue.keys?.join(', ') ?? null),
      message: issue.message,
    }));
    const bodyLevel = zodError.issues.some((i) => i.path.length === 0 && i.code !== 'unrecognized_keys');
    const codes = new Set(zodError.issues.map((i) => FIELD_CODES[i.path[0]] ?? 'VALIDATION_ERROR'));
    const code = bodyLevel ? 'INVALID_REQUEST_BODY' : codes.size === 1 ? [...codes][0] : 'VALIDATION_ERROR';
    const message = bodyLevel ? 'Request body must be a JSON object.' : issues.map((i) => i.message).join('; ');
    super(400, code, message, { errors: issues });
  }
}
