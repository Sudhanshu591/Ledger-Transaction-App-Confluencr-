import { useCallback, useEffect, useRef, useState } from 'react';
import { api, formatMoney } from './api.js';
import AccountStack from './components/AccountStack.jsx';
import ApiStatus from './components/ApiStatus.jsx';
import BalanceChart from './components/BalanceChart.jsx';
import CreateAccountForm from './components/CreateAccountForm.jsx';
import ErrorDialog from './components/ErrorDialog.jsx';
import Icon from './components/Icon.jsx';
import Modal from './components/Modal.jsx';
import MoneyFlow from './components/MoneyFlow.jsx';
import Sidebar from './components/Sidebar.jsx';
import TransactionForm from './components/TransactionForm.jsx';
import TransactionHistory from './components/TransactionHistory.jsx';
import TransferForm from './components/TransferForm.jsx';
import TransferSuccess from './components/TransferSuccess.jsx';

// The chart and money-movement widgets look at this many most recent transactions.
const INSIGHT_WINDOW = 100;

export default function App() {
  const [accounts, setAccounts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [recent, setRecent] = useState([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // 'account' | 'credit' | 'debit' | 'transfer'
  const [toast, setToast] = useState(null);
  // Balances stay masked until the user presses the eye button (resets on reload).
  const [showBalance, setShowBalance] = useState(false);
  // Bumped after every write so all widgets re-fetch.
  const [version, setVersion] = useState(0);

  const toastTimer = useRef(null);
  const notify = useCallback((kind, text) => {
    // New id restarts the enter/exit animation; clearing the old timer stops it hiding the new toast early.
    setToast({ id: Date.now(), kind, text });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const [error, setError] = useState(null);
  // User actions always explain a failure in a pop-up.
  const notifyError = useCallback((err) => setError(err), []);
  // Background refreshes stay quiet when the API is unreachable: the status indicator already shows "Offline".
  const notifyLoadError = useCallback((err) => err.code !== 'NETWORK_ERROR' && setError(err), []);
  const closeError = useCallback(() => setError(null), []);
  const [transferDone, setTransferDone] = useState(null);
  const closeTransferDone = useCallback(() => setTransferDone(null), []);
  const nameOf = (id) => accounts.find((a) => a.id === id)?.name ?? 'account';

  useEffect(() => {
    api.listAllAccounts().then(setAccounts).catch(notifyLoadError);
  }, [version, notifyLoadError]);

  useEffect(() => {
    if (!selectedId) return;
    api
      .listTransactions(selectedId, { limit: INSIGHT_WINDOW })
      .then((res) => setRecent(res.data))
      .catch(notifyLoadError);
  }, [selectedId, version, notifyLoadError]);

  const selected = accounts.find((a) => a.id === selectedId) ?? null;
  const visible = accounts.filter((a) => a.name.toLowerCase().includes(search.trim().toLowerCase()));

  // Select the first account on load, and if the search hides the selected account, switch to the first match.
  const firstVisibleId = visible[0]?.id;
  const selectedVisible = visible.some((a) => a.id === selectedId);
  useEffect(() => {
    if (!selectedVisible && firstVisibleId) setSelectedId(firstVisibleId);
  }, [selectedVisible, firstVisibleId]);
  // Recent transactions can briefly belong to the previously selected account while re-fetching.
  const recentForSelected = recent.filter((t) => t.account_id === selectedId);

  const onWrite = (message) => {
    setModal(null);
    notify('success', message);
    setVersion((v) => v + 1);
  };

  const onTransfer = (transfer) => {
    setModal(null);
    setTransferDone(transfer);
    setVersion((v) => v + 1);
  };

  return (
    <div className="shell">
      <Sidebar />

      <div className="content">
        <header className="topbar" id="top">
          <label className="search">
            <Icon name="search" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search accounts" />
          </label>
          <ApiStatus />
        </header>

        <div className="page-head">
          <div>
            <p className="eyebrow">Transaction Ledger</p>
            <h1>{selected ? selected.name : 'Welcome'}</h1>
          </div>
          <div className="actions">
            <button className="pill primary" disabled={!selected} onClick={() => setModal('credit')}>
              <Icon name="credit" size={16} /> Credit
            </button>
            <button className="pill" disabled={!selected} onClick={() => setModal('debit')}>
              <Icon name="debit" size={16} /> Debit
            </button>
            <button className="pill" disabled={!selected} onClick={() => setModal('transfer')}>
              <Icon name="swap" size={16} /> Transfer
            </button>
            <button className="pill" onClick={() => setModal('account')}>
              <Icon name="plus" size={16} /> New account
            </button>
          </div>
        </div>

        {accounts.length === 0 ? (
          <section className="card empty">
            <h3>No accounts yet</h3>
            <p className="muted">Create your first account to start recording transactions.</p>
            <button className="btn-primary" onClick={() => setModal('account')}>
              Create account
            </button>
          </section>
        ) : (
          <div className="dashboard">
            <AccountStack
              accounts={visible}
              selected={selected}
              totalCount={accounts.length}
              onSelect={setSelectedId}
              showBalance={showBalance}
              onToggleBalance={() => setShowBalance((s) => !s)}
              onCreate={() => setModal('account')}
            />
            {selected && (
              <>
                <BalanceChart account={selected} transactions={recentForSelected} />
                <MoneyFlow transactions={recentForSelected} />
                <TransferForm
                  key={selected.id}
                  source={selected}
                  accounts={accounts}
                  onDone={onTransfer}
                  onError={notifyError}
                  showBalance={showBalance}
                />
                <TransactionHistory accountId={selected.id} version={version} onError={notifyLoadError} />
              </>
            )}
          </div>
        )}
      </div>

      {modal === 'account' && (
        <Modal title="New account" onClose={() => setModal(null)}>
          <CreateAccountForm
            onDone={(account) => {
              setSelectedId(account.id);
              onWrite(`Account "${account.name}" created`);
            }}
            onError={notifyError}
          />
        </Modal>
      )}
      {(modal === 'credit' || modal === 'debit') && selected && (
        <Modal title="New transaction" onClose={() => setModal(null)}>
          <TransactionForm
            account={selected}
            initialType={modal}
            showBalance={showBalance}
            onDone={(t) => onWrite(`${t.type === 'credit' ? 'Credit' : 'Debit'} of ${formatMoney(t.amount)} recorded`)}
            onError={notifyError}
          />
        </Modal>
      )}
      {modal === 'transfer' && selected && (
        <Modal title="Transfer money" onClose={() => setModal(null)}>
          <TransferForm
            source={selected}
            accounts={accounts}
            onDone={onTransfer}
            onError={notifyError}
            showBalance={showBalance}
            inModal
          />
        </Modal>
      )}

      {transferDone && (
        <TransferSuccess
          transfer={transferDone}
          fromName={nameOf(transferDone.from_account_id)}
          toName={nameOf(transferDone.to_account_id)}
          onClose={closeTransferDone}
        />
      )}
      {error && <ErrorDialog error={error} onClose={closeError} />}
      {toast && (
        <div key={toast.id} className={`toast ${toast.kind}`} role="status">
          <span className="toast-icon">
            <Icon name="check" size={14} />
          </span>
          {toast.text}
        </div>
      )}
    </div>
  );
}
