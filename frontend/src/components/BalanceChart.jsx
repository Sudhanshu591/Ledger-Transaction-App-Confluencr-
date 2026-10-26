import { useMemo, useState } from 'react';
import { formatMoney } from '../api.js';
import { formatDate, round2 } from '../ui.js';

const W = 640;
const H = 220;
const PAD = { top: 16, right: 12, bottom: 12, left: 52 };

/** Rebuilds the running balance by walking back from the current balance through latest-first transactions. */
function buildSeries(account, transactions) {
  let balance = account.balance;
  const points = [];
  for (const t of transactions) {
    points.push({ balance, txn: t });
    balance = round2(balance + (t.type === 'credit' ? -t.amount : t.amount));
  }
  points.push({ balance, txn: null });
  return points.reverse();
}

function niceMax(value) {
  if (value <= 0) return 100;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

// Horizontal-tangent cubic segments: smooth, and never overshoots above/below the data.
function smoothPath(pts) {
  return pts.reduce((d, p, i) => {
    if (i === 0) return `M${p.x},${p.y}`;
    const prev = pts[i - 1];
    const mid = (prev.x + p.x) / 2;
    return `${d} C${mid},${prev.y} ${mid},${p.y} ${p.x},${p.y}`;
  }, '');
}

export default function BalanceChart({ account, transactions }) {
  const [hover, setHover] = useState(null);
  const series = useMemo(() => buildSeries(account, transactions), [account, transactions]);

  const max = niceMax(Math.max(...series.map((p) => p.balance)));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const pts = series.map((p, i) => ({
    ...p,
    x: PAD.left + (series.length === 1 ? innerW : (i / (series.length - 1)) * innerW),
    y: PAD.top + innerH - (p.balance / max) * innerH,
  }));
  const line = smoothPath(pts);
  const area = `${line} L${pts[pts.length - 1].x},${PAD.top + innerH} L${pts[0].x},${PAD.top + innerH} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);

  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    let nearest = 0;
    pts.forEach((p, i) => {
      if (Math.abs(p.x - x) < Math.abs(pts[nearest].x - x)) nearest = i;
    });
    setHover(nearest);
  }

  const h = hover !== null ? pts[hover] : null;

  return (
    <section className="card chart-card">
      <div className="card-head">
        <div>
          <h3>Balance trend</h3>
          <p className="muted small">
            {transactions.length ? `Last ${transactions.length} transactions` : 'No transactions yet'}
          </p>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="chart-empty muted">Add a credit to start the balance trend.</div>
      ) : (
        <div className="chart-wrap">
          <svg viewBox={`0 0 ${W} ${H}`} onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img"
            aria-label={`Balance trend for ${account.name}`}>
            <defs>
              <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.12" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {ticks.map((t) => {
              const y = PAD.top + innerH - (t / max) * innerH;
              return (
                <g key={t}>
                  <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} className="grid-line" />
                  <text x={PAD.left - 10} y={y + 4} className="axis-label" textAnchor="end">
                    {t >= 1000 ? `${round2(t / 1000)}k` : round2(t)}
                  </text>
                </g>
              );
            })}
            <path d={area} fill="url(#area-fill)" />
            <path d={line} className="trend-line" />
            {h && (
              <>
                <line x1={h.x} x2={h.x} y1={PAD.top} y2={PAD.top + innerH} className="hover-line" />
                <circle cx={h.x} cy={h.y} r="5" className="hover-dot" />
              </>
            )}
          </svg>
          {h && (
            <div className="chart-tip" style={{ left: `${(h.x / W) * 100}%`, top: `${(h.y / H) * 100}%` }}>
              <strong>{formatMoney(h.balance)}</strong>
              <span>
                {h.txn
                  ? `${h.txn.type === 'credit' ? '+' : '−'}${formatMoney(h.txn.amount)} · ${formatDate(h.txn.created_at)}`
                  : 'Opening balance'}
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
