import { formatMoney } from '../api.js';
import { formatDate, round2 } from '../ui.js';

const BARS = 18;
const TICKS = 48;

export default function MoneyFlow({ transactions }) {
  const moneyIn = round2(transactions.filter((t) => t.type === 'credit').reduce((s, t) => s + t.amount, 0));
  const moneyOut = round2(transactions.filter((t) => t.type === 'debit').reduce((s, t) => s + t.amount, 0));
  const spentRatio = moneyIn > 0 ? Math.min(moneyOut / moneyIn, 1) : 0;
  const filled = Math.round(spentRatio * TICKS);

  const recent = transactions.slice(0, BARS).reverse();
  const maxAmount = Math.max(1, ...recent.map((t) => t.amount));

  return (
    <section className="card flow-card">
      <div className="card-head">
        <div>
          <h3>Money movement</h3>
          <p className="muted small">
            {transactions.length
              ? `Based on the last ${transactions.length} transaction${transactions.length === 1 ? '' : 's'}`
              : 'No transactions yet'}
          </p>
        </div>
      </div>

      <div className="flow-figures">
        <div>
          <span className="dot credit" /> <span className="muted small">Money in</span>
          <strong>{formatMoney(moneyIn)}</strong>
        </div>
        <div>
          <span className="dot debit" /> <span className="muted small">Money out</span>
          <strong>{formatMoney(moneyOut)}</strong>
        </div>
        <div>
          <span className="muted small">Net</span>
          <strong className={moneyIn - moneyOut >= 0 ? 'pos' : 'neg'}>{formatMoney(round2(moneyIn - moneyOut))}</strong>
        </div>
      </div>

      <div className="ticks" aria-hidden="true">
        {Array.from({ length: TICKS }, (_, i) => (
          <span key={i} className={i < filled ? 'on' : ''} />
        ))}
      </div>
      <p className="muted small">
        {moneyIn > 0
          ? `${Math.round(spentRatio * 100)}% of the money received has gone out`
          : 'No money received yet'}
      </p>

      <div className="bars">
        {recent.map((t) => (
          <span
            key={t.id}
            className={`bar ${t.type}`}
            style={{ height: `${Math.max(6, (t.amount / maxAmount) * 100)}%` }}
            title={`${t.type} ${formatMoney(t.amount)} · ${formatDate(t.created_at)}`}
          />
        ))}
        {recent.length === 0 && <span className="muted small">No movement yet.</span>}
      </div>
    </section>
  );
}
