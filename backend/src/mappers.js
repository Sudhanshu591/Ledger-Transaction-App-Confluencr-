// Row -> API shape. Amounts leave the API as JSON numbers with 2-decimal precision.
const money = (value) => Number(value);
const timestamp = (value) => new Date(value).toISOString();

export const toAccount = (row) => ({
  id: row.id,
  name: row.name,
  balance: money(row.balance),
  created_at: timestamp(row.created_at),
});

export const toTransaction = (row) => ({
  id: row.id,
  account_id: row.account_id,
  type: row.type,
  amount: money(row.amount),
  description: row.description,
  reference_id: row.reference_id,
  transfer_id: row.transfer_id,
  created_at: timestamp(row.created_at),
});

export const toTransfer = (row) => ({
  id: row.id,
  from_account_id: row.from_account_id,
  to_account_id: row.to_account_id,
  amount: money(row.amount),
  description: row.description,
  reference_id: row.reference_id,
  created_at: timestamp(row.created_at),
});

export function toPagination(page, limit, totalRecords) {
  const totalPages = Math.ceil(totalRecords / limit);
  return {
    page,
    page_size: limit,
    total_records: totalRecords,
    total_pages: totalPages,
    has_next: page < totalPages,
    has_previous: page > 1,
  };
}
