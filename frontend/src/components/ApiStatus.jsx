import { useEffect, useState } from 'react';
import { checkHealth } from '../api.js';

const POLL_ONLINE_MS = 30_000;
const POLL_OFFLINE_MS = 10_000;
// A response slower than this usually means a free-tier host is waking from sleep.
const SLOW_MS = 3_000;
// Render's free plan can take about a minute to wake, so wait before giving up.
const TIMEOUT_MS = 75_000;

const LABELS = {
  checking: 'Connecting…',
  online: 'Connected',
  waking: 'Waking up…',
  offline: 'Offline',
};

export default function ApiStatus() {
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    let cancelled = false;
    let nextCheck;
    let slowTimer;

    async function check() {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      // Only show "waking up" if we weren't already connected.
      slowTimer = setTimeout(() => !cancelled && setStatus((s) => (s === 'online' ? s : 'waking')), SLOW_MS);

      let delay;
      try {
        await checkHealth(controller.signal);
        if (!cancelled) setStatus('online');
        delay = POLL_ONLINE_MS;
      } catch {
        if (!cancelled) setStatus('offline');
        delay = POLL_OFFLINE_MS;
      } finally {
        clearTimeout(timeout);
        clearTimeout(slowTimer);
      }
      if (!cancelled) nextCheck = setTimeout(check, delay);
    }

    check();
    return () => {
      cancelled = true;
      clearTimeout(nextCheck);
      clearTimeout(slowTimer);
    };
  }, []);

  return (
    <div className="topbar-right" role="status" title="Live status of the Ledger API and its database">
      <span className={`status-dot ${status}`} />
      <span className="muted small">{LABELS[status]}</span>
    </div>
  );
}
