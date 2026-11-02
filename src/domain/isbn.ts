/** ISBN helpers. An ISBN has 10 or 13 characters once spaces and hyphens are removed. */
export const cleanIsbn = (s: string) => s.replace(/[\s-]/g, '').toUpperCase();

export function isValidIsbn(input: string): boolean {
  const t = cleanIsbn(input);
  if (/^\d{13}$/.test(t)) {
    const sum = [...t].reduce((n, c, i) => n + Number(c) * (i % 2 ? 3 : 1), 0);
    return sum % 10 === 0;
  }
  if (/^\d{9}[\dX]$/.test(t)) {
    const sum = [...t].reduce((n, c, i) => n + (c === 'X' ? 10 : Number(c)) * (10 - i), 0);
    return sum % 11 === 0;
  }
  return false;
}

/** Looks like an ISBN being typed or scanned (so a search can match on it). */
export const looksLikeIsbn = (q: string) => /^[\d\s-]{10,17}[\dXx]?$/.test(q.trim()) && cleanIsbn(q).length >= 10;

/** Valid ISBN-13 for dummy data. */
export function dummyIsbn13(n: number): string {
  const body = '978' + String(100_000_000 + ((n * 7919) % 800_000_000)).padStart(9, '0');
  const sum = [...body].reduce((a, c, i) => a + Number(c) * (i % 2 ? 3 : 1), 0);
  return body + String((10 - (sum % 10)) % 10);
}
