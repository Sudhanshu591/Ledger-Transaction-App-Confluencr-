const ROOT_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const BASE_URL = ROOT_URL + '/api/v1';

/** Resolves when the API and its database respond; rejects otherwise. */
export async function checkHealth(signal) {
  const res = await fetch(`${ROOT_URL}/health`, { signal, cache: 'no-store' });
  if (!res.ok) throw new Error(`Health check failed with status ${res.status}`);
}

export class ApiError extends Error {
  constructor(status, error) {
    super(error?.message ?? `Request failed with status ${status}`);
    this.status = status;
    this.code = error?.code ?? 'NETWORK_ERROR';
    this.details = error?.details;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(BASE_URL + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, { code: 'NETWORK_ERROR', message: 'Cannot reach the API. Is the backend running?' });
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error);
  return data;
}

const query = (params) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
  return qs.toString() ? `?${qs}` : '';
};

export const api = {
  listAccounts: (params) => request(`/accounts${query(params)}`),
  /** Follows pagination so every account is returned, not just the first page. */
  async listAllAccounts() {
    const all = [];
    for (let page = 1; ; page++) {
      const res = await request(`/accounts${query({ page, limit: 100 })}`);
      all.push(...res.data);
      if (!res.pagination.has_next) return all;
    }
  },
  createAccount: (name) => request('/accounts', { method: 'POST', body: { name } }),
  getBalance: (id) => request(`/accounts/${id}/balance`),
  listTransactions: (id, params) => request(`/accounts/${id}/transactions${query(params)}`),
  createTransaction: (body) => request('/transactions', { method: 'POST', body }),
  createTransfer: (body) => request('/transfers', { method: 'POST', body }),
};

export const newReference = (prefix) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

export const formatMoney = (value) =>
  Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
