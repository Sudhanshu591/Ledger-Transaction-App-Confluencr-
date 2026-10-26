import { useEffect, useRef } from 'react';
import { formatMoney } from '../api.js';

export default function TransferSuccess({ transfer, fromName, toName, onClose }) {
  const okRef = useRef(null);

  useEffect(() => {
    okRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div className="modal-backdrop error-layer" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal error-dialog" role="alertdialog" aria-modal="true" aria-labelledby="success-title">
        <svg className="success-tick" viewBox="0 0 52 52" aria-hidden="true">
          <circle className="success-tick-circle" cx="26" cy="26" r="24" />
          <path className="success-tick-check" d="M15 27l7.5 7.5L37.5 19" />
        </svg>
        <h3 id="success-title">Transfer successful</h3>
        <p className="transfer-amount">{formatMoney(transfer.amount)}</p>
        <p className="muted">
          Sent from <strong>{fromName}</strong> to <strong>{toName}</strong>
        </p>
        <p className="muted small">Reference: {transfer.reference_id}</p>
        <button ref={okRef} className="btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
