import { useState } from 'react';
import { api, formatMoney, newReference } from '../api.js';
import { HIDDEN_AMOUNT, initials, toneOf } from '../ui.js';
import Icon from './Icon.jsx';

/** Rendered as the dashboard card, or inside a Modal (which supplies its own title) when inModal is set. */
export default function TransferForm({ source, accounts, onDone, onError, showBalance, inModal = false }) {
  const targets = accounts.filter((a) => a.id !== source.id);
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState('');
  const [referenceId, setReferenceId] = useState(newReference('TRF'));
  const [busy, setBusy] = useState(false);

  const target = targets.find((a) => a.id === toId);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      onDone(
        await api.createTransfer({
          from_account_id: source.id,
          to_account_id: toId,
          amount,
          reference_id: referenceId,
        }),
      );
      setAmount('');
      setReferenceId(newReference('TRF'));
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  }

  const fromLine = (
    <p className="muted small">
      From {source.name} · available {showBalance ? formatMoney(source.balance) : HIDDEN_AMOUNT}
    </p>
  );

  return (
    <form
      className={inModal ? 'transfer-modal' : 'card transfer-card'}
      id={inModal ? undefined : 'transfer'}
      onSubmit={submit}
    >
      {inModal ? (
        fromLine
      ) : (
        <div className="card-head">
          <div>
            <h3>Quick transfer</h3>
            {fromLine}
          </div>
        </div>
      )}

      {targets.length === 0 ? (
        <p className="muted small">Create another account to transfer money.</p>
      ) : (
        <>
          <div className="recipients">
            {targets.map((a) => (
              <button
                type="button"
                key={a.id}
                className={`recipient ${a.id === toId ? 'selected' : ''}`}
                onClick={() => setToId(a.id)}
                title={a.name}
              >
                <span className={`avatar tone-${toneOf(a.id)}`}>{initials(a.name) || <Icon name="user" />}</span>
                <span className="recipient-name">{a.name}</span>
              </button>
            ))}
          </div>

          <div className="amount-row">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              aria-label="Amount"
            />
            <button className="btn-primary" disabled={busy || !toId || !amount}>
              {target ? `Send to ${target.name.split(' ')[0]}` : 'Send'}
            </button>
          </div>
          <label className="ref-field">
            <span>Reference</span>
            <input value={referenceId} onChange={(e) => setReferenceId(e.target.value)} />
          </label>
        </>
      )}
    </form>
  );
}
