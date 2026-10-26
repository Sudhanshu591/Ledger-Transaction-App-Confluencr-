import { useState } from 'react';
import { api } from '../api.js';

export default function CreateAccountForm({ onDone, onError }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      onDone(await api.createAccount(name));
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <label className="field">
        Account holder name
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alice Sharma" autoFocus />
      </label>
      <p className="muted small">New accounts always start with a balance of 0.00.</p>
      <button className="btn-primary" disabled={busy}>
        Create account
      </button>
    </form>
  );
}
