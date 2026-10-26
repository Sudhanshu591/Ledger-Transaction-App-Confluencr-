import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import Logo from './Logo.jsx';

const LINKS = [
  { href: '#top', icon: 'home', label: 'Overview' },
  { href: '#history', icon: 'list', label: 'Transactions' },
  { href: '#transfer', icon: 'swap', label: 'Transfer' },
];

export default function Sidebar() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <nav className="rail" aria-label="Sections">
        <div className="rail-logo" title="Ledger">
          <Logo size={40} />
        </div>
        <button
          className="rail-toggle"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          title="Menu"
        >
          <Icon name="menu" />
        </button>
      </nav>

      <div className={`side-backdrop ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
      <aside className={`side-panel ${open ? 'open' : ''}`} aria-hidden={!open}>
        <div className="side-head">
          <span className="side-brand">
            <Logo size={30} /> Ledger
          </span>
          <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close menu" tabIndex={open ? 0 : -1}>
            <Icon name="close" />
          </button>
        </div>
        <div className="side-links">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="side-link" onClick={() => setOpen(false)} tabIndex={open ? 0 : -1}>
              <span className="side-link-icon">
                <Icon name={l.icon} />
              </span>
              {l.label}
            </a>
          ))}
        </div>
      </aside>
    </>
  );
}
