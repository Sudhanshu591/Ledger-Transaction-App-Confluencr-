// Stable visual identity per account (same account → same colour everywhere).
const TONES = 4;

export function toneOf(id) {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(hash) % TONES;
}

export function initials(name) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export const round2 = (n) => Math.round(n * 100) / 100;

/** Shown in place of a balance until the user reveals it. */
export const HIDDEN_AMOUNT = '••••••';

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });

export const formatTime = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
