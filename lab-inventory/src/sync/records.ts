import type { Activity, AppState, Item, Settings, StockTxn } from '../domain/types';

/** One row in the shared database. */
export interface RemoteRecord { collection: string; id: string; data: unknown }
/** A change to one row. data === null means "deleted". */
export type Change = { collection: string; id: string; data: unknown | null };
export type Snapshot = Map<string, Map<string, unknown>>;

/**
 * Settings that belong to the whole school, so every computer shares them.
 * The others (theme, text size, who is working, chosen columns, last backup) belong to one computer.
 */
const SHARED_SETTINGS = [
  'schoolName', 'currency', 'expiryWarnDays', 'serviceWarnDays', 'loanDefaultDays', 'allowNegativeStock', 'incompatible', 'codeFormat',
] as const satisfies readonly (keyof Settings)[];

export const MAX_ACTIVITY = 600;

/**
 * Everything shared between computers, as rows.
 *
 * Two things are left out on purpose, because they are worked out from the stock ledger on every computer:
 * an item's `quantity` and a ledger line's `balance`. If two computers used the same chemical at the same moment,
 * saving the quantity itself would let one overwrite the other and lose a deduction. Ledger lines are only ever
 * added, so they cannot clash, and the quantity is always their sum.
 */
export function snapshot(s: AppState): Snapshot {
  const out: Snapshot = new Map();
  const put = (c: string, id: string, v: unknown) => {
    let m = out.get(c);
    if (!m) out.set(c, (m = new Map()));
    m.set(id, v);
  };
  s.labs.forEach((x) => put('labs', x.id, x));
  s.categories.forEach((x) => put('categories', x.id, x));
  s.lists.forEach((x) => put('lists', x.id, x));
  s.modules.forEach((x) => put('modules', x.id, x));
  s.items.forEach((x) => { const { quantity: _q, ...rest } = x; void _q; put('items', x.id, rest); });
  s.txns.forEach((x) => { const { balance: _b, ...rest } = x; void _b; put('txns', x.id, rest); });
  s.records.forEach((x) => put('records', x.id, x));
  s.practicals.forEach((x) => put('practicals', x.id, x));
  s.stocktakes.forEach((x) => put('stocktakes', x.id, x));
  s.people.forEach((x) => put('people', x.id, x));
  s.suppliers.forEach((x) => put('suppliers', x.id, x));
  s.activity.slice(0, MAX_ACTIVITY).forEach((x) => put('activity', x.id, x));
  put('meta', 'settings', Object.fromEntries(SHARED_SETTINGS.map((k) => [k, s.settings[k]])));
  put('meta', 'flags', { setupDone: s.setupDone, sample: s.sample });
  return out;
}

function upsertById<T extends { id: string }>(arr: T[], changes: Change[]): T[] {
  const index = new Map(arr.map((x, i) => [x.id, i]));
  const out = arr.slice();
  const add: T[] = [];
  const del = new Set<string>();
  for (const c of changes) {
    if (c.data === null) del.add(c.id);
    else if (index.has(c.id)) out[index.get(c.id)!] = c.data as T;
    else add.push(c.data as T);
  }
  return del.size ? [...out.filter((x) => !del.has(x.id)), ...add] : [...out, ...add];
}

/**
 * Puts the ledger in time order, gives every line its running balance, and sets each item's quantity to the sum of its lines.
 * An item with no ledger lines holds nothing.
 */
export function rebuildLedger(items: Item[], txns: StockTxn[]): { items: Item[]; txns: StockTxn[] } {
  const sorted = txns.slice().sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0)); // stable: same-second lines keep their order
  const running = new Map<string, number>();
  const withBalance = sorted.map((t) => {
    const b = Math.round(((running.get(t.itemId) ?? 0) + t.delta) * 1e6) / 1e6;
    running.set(t.itemId, b);
    return t.balance === b ? t : { ...t, balance: b };
  });
  const nextItems = items.map((i) => {
    const q = running.get(i.id) ?? 0;
    return i.quantity === q ? i : { ...i, quantity: q };
  });
  return { items: nextItems, txns: withBalance };
}

/** Applies changes (from the database) onto the app's state. */
export function applyChanges(state: AppState, changes: Change[]): AppState {
  if (!changes.length) return state;
  const by = new Map<string, Change[]>();
  for (const c of changes) by.set(c.collection, [...(by.get(c.collection) ?? []), c]);
  const get = (c: string) => by.get(c);
  let s = state;

  if (get('labs')) s = { ...s, labs: upsertById(s.labs, get('labs')!) };
  if (get('categories')) s = { ...s, categories: upsertById(s.categories, get('categories')!) };
  if (get('lists')) s = { ...s, lists: upsertById(s.lists, get('lists')!) };
  if (get('modules')) s = { ...s, modules: upsertById(s.modules, get('modules')!) };
  if (get('records')) s = { ...s, records: upsertById(s.records, get('records')!) };
  if (get('practicals')) s = { ...s, practicals: upsertById(s.practicals, get('practicals')!) };
  if (get('stocktakes')) s = { ...s, stocktakes: upsertById(s.stocktakes, get('stocktakes')!).sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)) };
  if (get('people')) s = { ...s, people: upsertById(s.people, get('people')!) };
  if (get('suppliers')) s = { ...s, suppliers: upsertById(s.suppliers, get('suppliers')!) };
  if (get('activity')) {
    const merged = upsertById(s.activity, get('activity')!) as Activity[];
    s = { ...s, activity: merged.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, MAX_ACTIVITY) };
  }
  if (get('items') || get('txns')) {
    // Items arrive without a quantity (see snapshot): start them at their current one, then recompute everything from the ledger
    const incoming = (get('items') ?? []).map((c) => (c.data === null ? c : { ...c, data: { quantity: s.items.find((i) => i.id === c.id)?.quantity ?? 0, ...(c.data as object) } }));
    const items = incoming.length ? upsertById(s.items, incoming) : s.items;
    const txns = get('txns') ? upsertById(s.txns, get('txns')!) : s.txns;
    const r = rebuildLedger(items, txns);
    s = { ...s, items: r.items, txns: r.txns };
  }
  for (const c of get('meta') ?? []) {
    if (c.data === null) continue;
    if (c.id === 'settings') s = { ...s, settings: { ...s.settings, ...(c.data as Partial<Settings>) } };
    else if (c.id === 'flags') s = { ...s, setupDone: !!(c.data as { setupDone?: boolean }).setupDone, sample: !!(c.data as { sample?: boolean }).sample };
  }
  return s;
}

/** Same text for the same data, whatever order the keys came in. Used to tell whether two rows are really different. */
export function canon(v: unknown): string {
  return JSON.stringify(v, (_k, val) => (val && typeof val === 'object' && !Array.isArray(val)
    ? Object.fromEntries(Object.entries(val as Record<string, unknown>).filter(([, x]) => x !== undefined).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
    : val));
}
