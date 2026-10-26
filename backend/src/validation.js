import { z } from 'zod';
import { AppError, ValidationError } from './errors.js';

export const MAX_AMOUNT = 1_000_000_000_000; // 1 trillion per single operation
const TWO_DECIMALS = /^\d+(\.\d{1,2})?$/;

/**
 * Accepts a JSON number or numeric string, returns a normalized string ("50.00").
 * Money stays a string end-to-end and is computed by Postgres NUMERIC, never by JS floats.
 */
const amount = z.any().transform((value, ctx) => {
  const fail = (message) => {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    return z.NEVER;
  };
  if (value === undefined || value === null) return fail('amount is required');
  if (typeof value !== 'number' && typeof value !== 'string') return fail('amount must be a number');

  const text = typeof value === 'number' ? String(value) : value.trim();
  const numeric = Number(text);
  if (text === '' || !Number.isFinite(numeric)) return fail('amount must be a number');
  if (numeric <= 0) return fail('amount must be greater than 0');
  if (!TWO_DECIMALS.test(text)) return fail('amount must have at most 2 decimal places');
  if (numeric > MAX_AMOUNT) return fail(`amount must not exceed ${MAX_AMOUNT}`);
  const [whole, fraction = ''] = text.split('.');
  return `${BigInt(whole)}.${fraction.padEnd(2, '0')}`;
});

const requiredString = (field, max) =>
  z
    .string({ required_error: `${field} is required`, invalid_type_error: `${field} must be a string` })
    .trim()
    .min(1, `${field} is required`)
    .max(max, `${field} must be at most ${max} characters`);

const uuid = (field) =>
  z
    .string({ required_error: `${field} is required`, invalid_type_error: `${field} must be a string` })
    .uuid(`${field} must be a valid UUID`);

const description = z
  .string({ invalid_type_error: 'description must be a string' })
  .trim()
  .max(255, 'description must be at most 255 characters')
  .nullish()
  .transform((v) => (v ? v : null));

export const transactionType = z.enum(['credit', 'debit'], {
  errorMap: () => ({ message: "type must be either 'credit' or 'debit'" }),
});

export const createAccountSchema = z
  .object({ name: requiredString('name', 100) })
  .strict('Only "name" can be provided; balance always starts at 0 and other fields are system-generated');

export const createTransactionSchema = z
  .object({
    account_id: uuid('account_id'),
    type: transactionType,
    amount,
    description,
    reference_id: requiredString('reference_id', 100),
  })
  .strict();

export const createTransferSchema = z
  .object({
    from_account_id: uuid('from_account_id'),
    to_account_id: uuid('to_account_id'),
    amount,
    description,
    reference_id: requiredString('reference_id', 100),
  })
  .strict();

const positiveInt = (field, { max } = {}) => {
  let schema = z.coerce
    .number({ invalid_type_error: `${field} must be an integer` })
    .int(`${field} must be an integer`)
    .min(1, `${field} must be at least 1`);
  if (max) schema = schema.max(max, `${field} must be at most ${max}`);
  return schema;
};

export const paginationSchema = z.object({
  page: positiveInt('page').default(1),
  limit: positiveInt('limit', { max: 100 }).default(20),
});

export const historyQuerySchema = paginationSchema.extend({ type: transactionType.optional() });

export function parse(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success) throw new ValidationError(result.error);
  return result.data;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Path IDs: malformed values are rejected before they reach Postgres (which would raise 22P02). */
export function parseId(value, code = 'INVALID_ID') {
  if (!UUID_RE.test(value)) throw new AppError(400, code, `'${value}' is not a valid UUID.`);
  return value.toLowerCase();
}
