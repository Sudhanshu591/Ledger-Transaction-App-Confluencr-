import { useState } from 'react';
import { api, formatMoney, newReference } from '../api.js';
import { HIDDEN_AMOUNT } from '../ui.js';

export default function TransactionForm({ account, initialType = 'credit', onDone, onError, showBalance }) {
  const [form, setForm] = useState({ type: initialType, amount: '', description: '', reference_id: newReference('TXN') });
  const [busy, setBusy] = useState(false);
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      onDone(await api.createTransaction({ ...form, account_id: account.id, description: form.description || null }));
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <p className="muted small">
        {account.name} · balance {showBalance ? formatMoney(account.balance) : HIDDEN_AMOUNT}
      </p>
      <div className="segmented">
        {['credit', 'debit'].map((t) => (
          <label key={t} className={form.type === t ? `on ${t}` : ''}>
            <input type="radio" name="type" value={t} checked={form.type === t} onChange={set('type')} />
            {t}
          </label>
        ))}
      </div>
      <label className="field">
        Amount
        <input value={form.amount} onChange={set('amount')} placeholder="0.00" inputMode="decimal" autoFocus />
      </label>
      <label className="field">
        Description
        <input value={form.description} onChange={set('description')} placeholder="Optional" />
      </label>
      <label className="field">
        Reference ID
        <input value={form.reference_id} onChange={set('reference_id')} />
      </label>
      <button className="btn-primary" disabled={busy}>
        Record {form.type}
      </button>
    </form>
  );
}
