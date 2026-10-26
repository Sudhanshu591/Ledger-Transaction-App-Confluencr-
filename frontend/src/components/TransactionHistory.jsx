import { useEffect, useState } from 'react';
import { api, formatMoney } from '../api.js';
import { formatDate, formatTime } from '../ui.js';
import Icon from './Icon.jsx';

const PAGE_SIZE = 8;
const FILTERS = [
  ['', 'All'],
  ['credit', 'Credits'],
  ['debit', 'Debits'],
];

export default function TransactionHistory({ accountId, version, onError }) {
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);

  // Reset to page 1 when switching account or filter.
  useEffect(() => setPage(1), [accountId, type]);

  useEffect(() => {
    let cancelled = false;
    api
      .listTransactions(accountId, { type, page, limit: PAGE_SIZE })
      .then((res) => !cancelled && setResult(res))
      .catch(onError);
    return () => {
      cancelled = true;
    };
  }, [accountId, type, page, version, onError]);

  const p = result?.pagination;

  return (
    <section className="card history-card" id="history">
      <div className="card-head">
        <h3>Transactions</h3>
        <div className="chips">
          {FILTERS.map(([value, label]) => (
            <button key={label} className={`chip ${type === value ? 'on' : ''}`} onClick={() => setType(value)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="txn-list">
        {result?.data.map((t) => (
          <div className="txn-row" key={t.id}>
            <span className={`txn-icon ${t.type}`}>
              <Icon name={t.type} size={16} />
            </span>
            <div className="txn-main">
              <span>{t.description ?? (t.type === 'credit' ? 'Credit' : 'Debit')}</span>
              <code>{t.reference_id}</code>
            </div>
            <div className="txn-date">
              <span>{formatDate(t.created_at)}</span>
              <span className="muted small">{formatTime(t.created_at)}</span>
            </div>
            <span className={`txn-amount ${t.type}`}>
              {t.type === 'debit' ? '−' : '+'}
              {formatMoney(t.amount)}
            </span>
          </div>
        ))}
        {result?.data.length === 0 && <p className="muted small pad">No transactions.</p>}
      </div>

      {p && p.total_pages > 0 && (
        <div className="row-between pager">
          <span className="muted small">
            Page {p.page} of {p.total_pages} · {p.total_records} records
          </span>
          <div className="pager-btns">
            <button className="btn-ghost" disabled={!p.has_previous} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <button className="btn-ghost" disabled={!p.has_next} onClick={() => setPage(page + 1)}>
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
