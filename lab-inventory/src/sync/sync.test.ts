import { describe, expect, it } from 'vitest';
import { emptyState } from '../domain/defaults';
import { buildSample } from '../domain/sample';
import type { AppState, StockTxn } from '../domain/types';
import * as A from '../store/actions';
import { getState, replaceState, storeApi } from '../store/store';
import { SyncEngine, RemoteError, type Op, type Remote, type StoreApi } from './engine';
import type { Change, RemoteRecord } from './records';
import { applyChanges, rebuildLedger, snapshot } from './records';

/** A shared database held in memory. Saves are all-or-nothing and every connected computer hears about every change. */
class FakeRemote implements Remote {
  rows = new Map<string, unknown>();
  subs = new Set<(c: Change[]) => void>();
  failNext: RemoteError | null = null;
  applied: Op[][] = [];
  async loadAll(): Promise<RemoteRecord[]> {
    return [...this.rows].map(([k, data]) => { const i = k.indexOf('|'); return { collection: k.slice(0, i), id: k.slice(i + 1), data }; });
  }
  async apply(ops: Op[]) {
    if (this.failNext) { const e = this.failNext; this.failNext = null; throw e; }
    this.applied.push(ops);
    for (const o of ops) { const k = `${o.c}|${o.id}`; if (o.d === null) this.rows.delete(k); else this.rows.set(k, JSON.parse(JSON.stringify(o.d))); }
    const ch = ops.map((o) => ({ collection: o.c, id: o.id, data: o.d }));
    queueMicrotask(() => this.subs.forEach((s) => s(ch)));
  }
  subscribe(onChange: (c: Change[]) => void, onConnection: (up: boolean) => void) {
    this.subs.add(onChange);
    onConnection(true);
    return () => { this.subs.delete(onChange); };
  }
}

/** A second computer: its own copy of the data. */
class FakeStore implements StoreApi {
  state: AppState = emptyState();
  fns = new Set<() => void>();
  get = () => this.state;
  set = (n: AppState) => { this.state = n; this.fns.forEach((f) => f()); };
  update = (fn: (s: AppState) => AppState) => { this.state = fn(this.state); this.fns.forEach((f) => f()); };
  subscribe = (f: () => void) => { this.fns.add(f); return () => this.fns.delete(f); };
  /** What the app does when someone uses stock: one ledger line, and the quantity follows. */
  use(itemId: string, qty: number, at = '2026-11-21T10:00:00') {
    const it = this.state.items.find((i) => i.id === itemId)!;
    const balance = it.quantity - qty;
    const t: StockTxn = { id: `t-${Math.random().toString(36).slice(2)}`, itemId, labId: it.labId, at, type: 'use', delta: -qty, balance };
    this.set({ ...this.state, txns: [...this.state.txns, t], items: this.state.items.map((i) => (i.id === itemId ? { ...i, quantity: balance } : i)) });
  }
}

const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
function engineFor(remote: Remote, store: StoreApi, notices: string[] = [], statuses: string[] = []) {
  return new SyncEngine(remote, store, () => ({ ...emptyState(), settings: { ...emptyState().settings, theme: 'dark' } }), (s) => statuses.push(s), (m) => notices.push(m), 5);
}
const qty = (s: AppState, name: string) => s.items.find((i) => i.name === name)!.quantity;

describe('rows', () => {
  it('leave out quantity and balance, which are worked out from the ledger', () => {
    const s = buildSample({ ...emptyState(), setupDone: true });
    const snap = snapshot(s);
    const item = [...snap.get('items')!.values()][0] as Record<string, unknown>;
    const txn = [...snap.get('txns')!.values()][0] as Record<string, unknown>;
    expect('quantity' in item).toBe(false);
    expect('balance' in txn).toBe(false);
  });
  it('rebuild every quantity and balance from the ledger', () => {
    const s = buildSample({ ...emptyState(), setupDone: true });
    const stripped = s.items.map((i) => ({ ...i, quantity: 0 }));
    const r = rebuildLedger(stripped, s.txns.map((t) => ({ ...t, balance: 0 })));
    expect(r.items.map((i) => [i.id, i.quantity])).toEqual(s.items.map((i) => [i.id, i.quantity]));
    const byId = new Map(r.txns.map((t) => [t.id, t.balance]));
    expect(s.txns.every((t) => byId.get(t.id) === t.balance)).toBe(true);
  });
  it('round-trip: state -> rows -> state is lossless for the shared parts', () => {
    const s = buildSample({ ...emptyState(), setupDone: true });
    const changes = [...snapshot(s)].flatMap(([collection, rows]) => [...rows].map(([id, data]) => ({ collection, id, data })));
    const back = applyChanges({ ...emptyState(), settings: { ...emptyState().settings, theme: 'dark' } }, changes);
    expect(back.items.map((i) => [i.id, i.quantity]).sort()).toEqual(s.items.map((i) => [i.id, i.quantity]).sort());
    expect(back.records.length).toBe(s.records.length);
    expect(back.labs.length).toBe(s.labs.length);
    expect(back.modules.length).toBe(s.modules.length);
    expect(back.settings.schoolName).toBe(s.settings.schoolName);
    expect(back.settings.theme).toBe('dark'); // this computer's own preference is not overwritten
    expect(back.setupDone).toBe(true);
    expect(back.sample).toBe(true);
  });
});

describe('two computers sharing one database', () => {
  it('the first computer to connect uploads its data and the second one receives all of it', async () => {
    const remote = new FakeRemote();
    replaceState({ ...buildSample({ ...emptyState(), setupDone: true }), settings: { ...emptyState().settings, schoolName: 'Shared School' } });
    const a = engineFor(remote, storeApi);
    expect(await a.start(getState())).toBe('adopted');
    await a.settle();

    const b = new FakeStore();
    const eb = engineFor(remote, b);
    expect(await eb.start()).toBe('loaded');
    expect(b.state.items.length).toBe(getState().items.length);
    expect(b.state.items.map((i) => i.quantity)).toEqual(getState().items.map((i) => i.quantity));
    expect(b.state.settings.schoolName).toBe('Shared School');
    expect(b.state.settings.theme).toBe('dark'); // its own preference survived
    expect(b.state.setupDone).toBe(true);
    a.stop(); eb.stop();
  });

  it('two people using the same chemical at the same moment are both counted', async () => {
    const remote = new FakeRemote();
    replaceState(buildSample({ ...emptyState(), setupDone: true }));
    const a = engineFor(remote, storeApi);
    await a.start(getState());
    await a.settle();
    const b = new FakeStore();
    const eb = engineFor(remote, b);
    await eb.start();

    const naoh = getState().items.find((i) => i.name === 'Sodium hydroxide pellets')!;
    const start = naoh.quantity;
    // Both save at the same instant, neither has heard from the other yet
    A.saveRecord('usage', 'chemistry', { date: '2026-11-21', item: naoh.id, quantity: 50 });
    b.use(naoh.id, 30, '2026-11-21T10:00:01');
    await tick(120);
    await a.settle(); await eb.settle();
    await tick(60);

    expect(qty(getState(), 'Sodium hydroxide pellets')).toBe(start - 80);
    expect(qty(b.state, 'Sodium hydroxide pellets')).toBe(start - 80);
    const ledgerA = getState().txns.filter((t) => t.itemId === naoh.id);
    const ledgerB = b.state.txns.filter((t) => t.itemId === naoh.id);
    expect(ledgerA.length).toBe(ledgerB.length);
    expect(ledgerA.at(-1)!.balance).toBe(start - 80);
    expect(ledgerB.at(-1)!.balance).toBe(start - 80);
    // and neither computer keeps rewriting the other's numbers
    const before = remote.applied.length;
    await tick(120);
    expect(remote.applied.length).toBe(before);
    a.stop(); eb.stop();
  });

  it('a change made on one computer appears on the other, and deleting an item removes its ledger too', async () => {
    const remote = new FakeRemote();
    replaceState(buildSample({ ...emptyState(), setupDone: true }));
    const a = engineFor(remote, storeApi);
    await a.start(getState());
    await a.settle();
    const b = new FakeStore();
    const eb = engineFor(remote, b);
    await eb.start();

    const id = A.addItem({ labId: 'physics', categoryId: 'instruments', name: 'New lens', quantity: 7, unit: 'pcs', status: 'Good', custom: {} });
    await tick(100); await a.settle(); await tick(50);
    expect(b.state.items.find((i) => i.id === id)?.quantity).toBe(7);

    A.deleteItem(id);
    await tick(100); await a.settle(); await tick(50);
    expect(b.state.items.find((i) => i.id === id)).toBeUndefined();
    expect(b.state.txns.some((t) => t.itemId === id)).toBe(false);
    a.stop(); eb.stop();
  });

  it('shared settings travel, this computer’s preferences do not', async () => {
    const remote = new FakeRemote();
    replaceState(buildSample({ ...emptyState(), setupDone: true }));
    const a = engineFor(remote, storeApi);
    await a.start(getState());
    await a.settle();
    const b = new FakeStore();
    const eb = engineFor(remote, b);
    await eb.start();
    A.updateSettings({ expiryWarnDays: 99, theme: 'light', currentUser: 'Ms. A' });
    await tick(100); await a.settle(); await tick(50);
    expect(b.state.settings.expiryWarnDays).toBe(99);
    expect(b.state.settings.theme).toBe('dark');
    expect(b.state.settings.currentUser).toBe('');
    a.stop(); eb.stop();
  });

  it('keeps unsaved work when the connection drops, and saves it when it returns', async () => {
    const remote = new FakeRemote();
    replaceState(buildSample({ ...emptyState(), setupDone: true }));
    const statuses: string[] = [];
    const a = engineFor(remote, storeApi, [], statuses);
    await a.start(getState());
    await a.settle();
    remote.failNext = new RemoteError('network', 'Failed to fetch');
    A.saveRecord('diary', 'chemistry', { date: '2026-11-21', title: 'Written offline' });
    await tick(60);
    expect(statuses).toContain('offline');
    expect(a.hasUnsaved()).toBe(true);
    a.saveNow(); // the connection is back
    await a.settle();
    expect(a.hasUnsaved()).toBe(false);
    expect([...remote.rows.values()].some((v) => (v as { values?: { title?: string } }).values?.title === 'Written offline')).toBe(true);
    a.stop();
  });

  it('when the database refuses a change, the latest shared version is loaded and the user is told', async () => {
    const remote = new FakeRemote();
    replaceState(buildSample({ ...emptyState(), setupDone: true }));
    const notices: string[] = [];
    const a = engineFor(remote, storeApi, notices);
    await a.start(getState());
    await a.settle();
    remote.failNext = new RemoteError('conflict', 'duplicate key value');
    A.saveRecord('diary', 'chemistry', { date: '2026-11-21', title: 'Will be refused' });
    await tick(80); await a.settle();
    expect(notices.length).toBe(1);
    expect(getState().records.some((r) => r.values.title === 'Will be refused')).toBe(false);
    a.stop();
  });

  it('starts with the setup wizard, and uploads nothing, when the database is empty and this computer has no data', async () => {
    const remote = new FakeRemote();
    const b = new FakeStore();
    const eb = engineFor(remote, b);
    expect(await eb.start()).toBe('empty');
    await tick(50);
    expect(remote.applied.length).toBe(0);
    // once setup is completed, the first computer's data is shared
    b.set({ ...buildSample({ ...emptyState(), setupDone: true }), settings: b.state.settings });
    await tick(80); await eb.settle();
    expect(remote.rows.size).toBeGreaterThan(50);
    eb.stop();
  });

  it('an interrupted first upload is completed rather than half-loaded', async () => {
    const remote = new FakeRemote();
    const full = buildSample({ ...emptyState(), setupDone: true });
    // only part of this computer's data had reached the database
    const partial = [...snapshot(full)].flatMap(([c, rows]) => [...rows].map(([id, data]) => ({ c, id, data }))).slice(0, 40);
    for (const p of partial) remote.rows.set(`${p.c}|${p.id}`, p.data);
    const b = new FakeStore();
    const eb = engineFor(remote, b);
    expect(await eb.start(full, true)).toBe('adopted');
    await eb.settle();
    expect(remote.rows.size).toBe([...snapshot(full)].reduce((n, [, r]) => n + r.size, 0));
    eb.stop();
  });
});

describe('connection settings', () => {
  const jwt = (role: string) => `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ role })).replace(/=+$/, "")}.signaturesignaturesig`;
  it('accepts a normal URL and anon key', async () => {
    const { checkConfigInput } = await import('./config');
    expect(checkConfigInput('https://abcdefgh.supabase.co', jwt('anon'))).toBeNull();
    expect(checkConfigInput(' https://abcdefgh.supabase.co/ ', jwt('anon'))).toBeNull();
  });
  it('refuses a bad URL, a short key, and the service_role key', async () => {
    const { checkConfigInput } = await import('./config');
    expect(checkConfigInput('not a url', jwt('anon'))).toMatch(/should look like/);
    expect(checkConfigInput('http://abcdefgh.supabase.co', jwt('anon'))).toMatch(/should look like/);
    expect(checkConfigInput('https://abcdefgh.supabase.co', 'short')).toMatch(/too short/);
    expect(checkConfigInput('https://abcdefgh.supabase.co', jwt('service_role'))).toMatch(/service_role/);
  });
  it('ignores the placeholder values that ship in config.js', async () => {
    const { normalise } = await import('./config');
    expect(normalise({ mode: 'supabase', url: 'PASTE-YOUR-PROJECT-URL-HERE', anonKey: 'PASTE-YOUR-ANON-PUBLIC-KEY-HERE' })).toBeNull();
    expect(normalise({ mode: 'supabase', url: 'https://a.supabase.co/', anonKey: ' k ' })).toEqual({ mode: 'supabase', url: 'https://a.supabase.co', anonKey: 'k' });
  });
});
