import { formatMoney } from '../api.js';
import { HIDDEN_AMOUNT } from '../ui.js';
import Icon from './Icon.jsx';

export default function AccountStack({ accounts, selected, totalCount, onSelect, onCreate, showBalance, onToggleBalance }) {
  const filtered = accounts.length !== totalCount;

  return (
    <section className="card accounts-card">
      <div className="card-stack">
        {accounts.map((a) => (
          <button
            key={a.id}
            className={`account-chip ${a.id === selected?.id ? 'selected' : ''}`}
            onClick={() => onSelect(a.id)}
            aria-pressed={a.id === selected?.id}
          >
            <span className="chip-name">{a.name}</span>
          </button>
        ))}
        {accounts.length === 0 && <p className="muted small pad">No accounts match your search.</p>}
      </div>
      <div className="stack-footer">
        <span className="pill-tag">
          {filtered ? `${accounts.length} of ${totalCount}` : totalCount} account{totalCount === 1 ? '' : 's'}
        </span>
        <p className="muted small">Balance</p>
        <div className="balance-row">
          <strong className={`total ${showBalance ? '' : 'masked'}`}>
            {showBalance ? formatMoney(selected?.balance ?? 0) : HIDDEN_AMOUNT}
          </strong>
          <button
            className="eye-btn"
            onClick={onToggleBalance}
            aria-label={showBalance ? 'Hide balance' : 'Show balance'}
            aria-pressed={showBalance}
            title={showBalance ? 'Hide balance' : 'Show balance'}
          >
            <Icon name={showBalance ? 'eyeOff' : 'eye'} size={18} />
          </button>
        </div>
        <button className="fab" onClick={onCreate} aria-label="New account" title="New account">
          <Icon name="plus" />
        </button>
      </div>
    </section>
  );
}
