// Dates are plain local strings: 'YYYY-MM-DD' for a day, 'YYYY-MM-DDTHH:mm' for a moment.
// No time zones are involved, so a record never shifts a day when someone travels or a laptop clock changes zone.

const pad = (n: number) => String(n).padStart(2, '0');

export function todayStr(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function nowStr(d = new Date()): string {
  return `${todayStr(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parts(s: string): [number, number, number] {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return [y, m, d];
}

export function isDate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s);
}

export function addDays(s: string, n: number): string {
  const [y, m, d] = parts(s);
  return todayStr(new Date(y, m - 1, d + n));
}

/** Whole days from a to b (b - a). Negative when b is earlier. */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = parts(a);
  const [by, bm, bd] = parts(b);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDate(s?: string | null): string {
  if (!isDate(s)) return '';
  const [y, m, d] = parts(s);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function fmtDateTime(s?: string | null): string {
  if (!isDate(s)) return '';
  const t = s.length >= 16 ? ` ${s.slice(11, 16)}` : '';
  return fmtDate(s) + t;
}

export function fmtMonth(s: string): string {
  const [y, m] = parts(s);
  return `${MONTHS[m - 1]} ${y}`;
}

/** "in 3 days", "today", "5 days ago" */
export function relDays(s: string, today = todayStr()): string {
  const n = daysBetween(today, s);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

export function startOfMonth(s = todayStr()): string {
  return `${s.slice(0, 7)}-01`;
}

/** Academic year starting in April: returns the first day of the current one. */
export function startOfAcademicYear(s = todayStr()): string {
  const [y, m] = parts(s);
  return `${m >= 4 ? y : y - 1}-04-01`;
}

/** Timestamp with seconds, for the stock ledger. */
export function stamp(d = new Date()): string {
  return `${nowStr(d)}:${pad(d.getSeconds())}`;
}

/**
 * Reads dates as people type or paste them from Excel: 2026-11-21, 21/11/2026, 21-11-26,
 * 21 Nov 2026. Day comes first in the dd/mm/yyyy forms. Returns '' when it cannot tell.
 */
export function parseDateLoose(input: string): string {
  const s = input.trim();
  if (!s) return '';
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/.exec(s);
  if (m) return valid(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  m = /^(\d{1,2})[ \-]([A-Za-z]{3,9})[ \-,]*(\d{2,4})$/.exec(s);
  if (m) {
    const mi = MONTHS.findIndex((x) => m![2].toLowerCase().startsWith(x.toLowerCase()));
    if (mi >= 0) return valid(m[3].length === 2 ? 2000 + +m[3] : +m[3], mi + 1, +m[1]);
  }
  return '';
}

function valid(y: number, mo: number, d: number): string {
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return '';
  return todayStr(dt);
}
