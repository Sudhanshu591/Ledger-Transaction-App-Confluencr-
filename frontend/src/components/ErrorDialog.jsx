import { useEffect, useRef } from 'react';
import { formatMoney } from '../api.js';
import Icon from './Icon.jsx';

// Turns an API error code into a human title + explanation.
function describe(err) {
  const d = err.details ?? {};
  switch (err.code) {
    case 'INSUFFICIENT_BALANCE':
      return {
        title: 'Insufficient balance',
        message: `This account has ${formatMoney(d.balance)} available, but the debit is for ${formatMoney(d.requested_amount)}. Nothing was changed.`,
      };
    case 'DUPLICATE_TRANSACTION':
      return {
        title: 'Already recorded',
        message: `A transaction with reference "${d.existing_transaction?.reference_id}" already exists for this account. Nothing was changed. Use a new reference ID for a new transaction.`,
      };
    case 'DUPLICATE_TRANSFER':
      return {
        title: 'Transfer already made',
        message: `A transfer with reference "${d.existing_transfer?.reference_id}" was already sent from this account. Nothing was changed.`,
      };
    case 'SAME_ACCOUNT_TRANSFER':
      return { title: 'Choose a different account', message: 'Money can only be transferred between two different accounts.' };
    case 'ACCOUNT_NOT_FOUND':
      return { title: 'Account not found', message: 'This account no longer exists. Refresh the page and try again.' };
    case 'NETWORK_ERROR':
      return { title: "Can't reach the server", message: 'The Ledger API is not responding. Check that the backend is running, then try again.' };
    case 'INVALID_AMOUNT':
    case 'INVALID_TRANSACTION_TYPE':
    case 'INVALID_ACCOUNT_ID':
    case 'INVALID_PAGINATION':
    case 'VALIDATION_ERROR':
    case 'INVALID_REQUEST_BODY':
      return {
        title: 'Please check your input',
        message: null,
        list: d.errors?.map((e) => e.message) ?? [err.message],
      };
    default:
      return { title: 'Something went wrong', message: err.message };
  }
}

export default function ErrorDialog({ error, onClose }) {
  const okRef = useRef(null);
  const { title, message, list } = describe(error);

  useEffect(() => {
    okRef.current?.focus();
    // Capture phase + stopImmediatePropagation: Esc closes only this dialog, not a form underneath it.
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
      <div className="modal error-dialog" role="alertdialog" aria-modal="true" aria-labelledby="error-title">
        <span className="error-icon">
          <Icon name="alert" size={26} />
        </span>
        <h3 id="error-title">{title}</h3>
        {message && <p className="muted">{message}</p>}
        {list && (
          <ul className="error-list">
            {list.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
        <button ref={okRef} className="btn-primary" onClick={onClose}>
          OK
        </button>
      </div>
    </div>
  );
}
