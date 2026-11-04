import type { AppState } from '../domain/types';
import { applyChanges, canon, snapshot, type Change, type RemoteRecord } from './records';

export type SyncStatus = 'connecting' | 'live' | 'saving' | 'offline' | 'error';
export interface Op { c: string; id: string; d: unknown | null }

export class RemoteError extends Error {
  constructor(public kind: 'conflict' | 'network' | 'auth' | 'other', message: string) { super(message); }
}

/** The shared database, seen from the app. Supabase implements it; so does a stand-in used for testing. */
export interface Remote {
  loadAll(): Promise<RemoteRecord[]>;
  /** Saves all ops together or none. Throws RemoteError. */
  apply(ops: Op[]): Promise<void>;
  subscribe(onChange: (changes: Change[]) => void, onConnection: (up: boolean) => void): () => void;
}

export interface StoreApi {
  get(): AppState;
  set(next: AppState): void;
  update(fn: (s: AppState) => AppState): void;
  subscribe(fn: () => void): () => void;
}

const CHUNK = 400;

/**
 * Keeps this device's state and the shared database equal.
 *  - local changes are found by comparing the state with what the database last held ("shadow") and sent as one atomic batch
 *  - changes made on other devices arrive live and are applied, unless there is an unsaved local edit to the same row
 *  - if the database refuses a change (for example two devices issued the same book), local state is reloaded from the database
 */
export class SyncEngine {
  private shadow = new Map<string, Map<string, string>>();
  private cache = new WeakMap<object, string>();
  private timer: number | undefined;
  private retry = 3000;
  private flushing = false;
  private again = false;
  private unsubs: Array<() => void> = [];
  private stopped = false;
  wasUp = true;

  constructor(
    private remote: Remote,
    private store: StoreApi,
    private emptyBase: () => AppState,
    private onStatus: (s: SyncStatus, detail?: string) => void,
    private onNotice: (message: string) => void,
    private debounceMs = 200,
  ) {}

  private json(v: unknown): string {
    if (v && typeof v === 'object') {
      const hit = this.cache.get(v as object);
      if (hit !== undefined) return hit;
      const s = canon(v);
      this.cache.set(v as object, s);
      return s;
    }
    return canon(v);
  }

  private shadowOf(state: AppState) {
    const m = new Map<string, Map<string, string>>();
    for (const [c, rows] of snapshot(state)) {
      const inner = new Map<string, string>();
      for (const [id, v] of rows) inner.set(id, this.json(v));
      m.set(c, inner);
    }
    return m;
  }

  async start() {
    this.onStatus('connecting');
    const records = await this.remote.loadAll();
    const changes = records.map((r) => ({ collection: r.collection, id: r.id, data: r.data }));
    const next = applyChanges(this.emptyBase(), changes);
    // an empty database has nothing yet: send our defaults on the first save
    this.shadow = records.length ? this.shadowOf(next) : new Map();
    this.store.set(next);
    this.unsubs.push(this.remote.subscribe((c) => this.onRemote(c), (up) => this.onConnection(up)));
    this.unsubs.push(this.store.subscribe(() => this.schedule()));
    if (!records.length) this.schedule(0);
    this.onStatus('live');
  }

  stop() {
    this.stopped = true;
    window.clearTimeout(this.timer);
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
  }

  /** True while there are changes this device has not managed to save yet. */
  hasUnsaved(): boolean {
    return this.flushing || this.diff().ops.length > 0;
  }

  /** Saves right now instead of waiting for the short pause (used when the page is being hidden or closed). */
  saveNow() {
    window.clearTimeout(this.timer);
    void this.flush();
  }

  /** Waits until everything typed so far has been saved. */
  async settle(): Promise<void> {
    window.clearTimeout(this.timer);
    await this.flush();
  }

  private schedule(ms = this.debounceMs) {
    if (this.stopped) return;
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.flush(), ms);
  }

  private diff(): { ops: Op[]; applied: Array<[string, string, string | null]> } {
    const ops: Op[] = [];
    const applied: Array<[string, string, string | null]> = [];
    const now = snapshot(this.store.get());
    for (const [c, rows] of now) {
      const prev = this.shadow.get(c);
      for (const [id, v] of rows) {
        const j = this.json(v);
        if (prev?.get(id) !== j) { ops.push({ c, id, d: v }); applied.push([c, id, j]); }
      }
      if (prev) for (const id of prev.keys()) if (!rows.has(id)) { ops.push({ c, id, d: null }); applied.push([c, id, null]); }
    }
    for (const [c, prev] of this.shadow) if (!now.has(c)) for (const id of prev.keys()) { ops.push({ c, id, d: null }); applied.push([c, id, null]); }
    return { ops, applied };
  }

  private async flush(): Promise<void> {
    if (this.stopped) return;
    if (this.flushing) { this.again = true; return; }
    const { ops, applied } = this.diff();
    if (!ops.length) return;
    this.flushing = true;
    this.onStatus('saving');
    try {
      for (let i = 0; i < ops.length; i += CHUNK) {
        await this.remote.apply(ops.slice(i, i + CHUNK));
        for (const [c, id, j] of applied.slice(i, i + CHUNK)) {
          let m = this.shadow.get(c);
          if (!m) this.shadow.set(c, (m = new Map()));
          if (j === null) m.delete(id); else m.set(id, j);
        }
      }
      this.retry = 3000;
      this.onStatus('live');
    } catch (e) {
      const err = e instanceof RemoteError ? e : new RemoteError('other', String(e));
      if (err.kind === 'conflict') {
        this.onNotice('Someone else changed the same thing at the same moment, so your last change was not saved. The latest version has been loaded.');
        await this.hardResync();
      } else if (err.kind === 'auth') {
        this.onStatus('error', 'Your sign-in has expired. Sign in again.');
      } else if (err.kind === 'network') {
        this.onStatus('offline');
        window.clearTimeout(this.timer);
        this.timer = window.setTimeout(() => void this.flush(), this.retry);
        this.retry = Math.min(this.retry * 2, 30000);
      } else {
        this.onStatus('error', err.message);
      }
    } finally {
      this.flushing = false;
      if (this.again) { this.again = false; this.schedule(0); }
    }
  }

  /** Throws away unsaved local changes and loads exactly what the database holds. */
  async hardResync() {
    try {
      const records = await this.remote.loadAll();
      const next = applyChanges(this.emptyBase(), records.map((r) => ({ collection: r.collection, id: r.id, data: r.data })));
      this.shadow = records.length ? this.shadowOf(next) : new Map();
      this.store.set(next);
      this.onStatus('live');
    } catch {
      this.onStatus('offline');
    }
  }

  private onConnection(up: boolean) {
    if (up && !this.wasUp) { this.wasUp = true; void this.reconcile(); this.schedule(0); }
    if (!up) { this.wasUp = false; this.onStatus('offline'); }
    if (up) this.onStatus('live');
  }

  /** After a dropped connection: pick up anything that changed while away, keeping unsaved local edits. */
  private async reconcile() {
    try {
      const records = await this.remote.loadAll();
      const seen = new Map<string, Set<string>>();
      const changes: Change[] = [];
      for (const r of records) {
        let s = seen.get(r.collection);
        if (!s) seen.set(r.collection, (s = new Set()));
        s.add(r.id);
        changes.push({ collection: r.collection, id: r.id, data: r.data });
      }
      for (const [c, rows] of this.shadow) for (const id of rows.keys()) if (!seen.get(c)?.has(id)) changes.push({ collection: c, id, data: null });
      this.onRemote(changes);
    } catch { /* the next event or retry will catch up */ }
  }

  private onRemote(changes: Change[]) {
    if (this.stopped || !changes.length) return;
    const current = snapshot(this.store.get());
    const take: Change[] = [];
    for (const ch of changes) {
      const incoming = ch.data === null ? null : this.json(ch.data);
      const known = this.shadow.get(ch.collection)?.get(ch.id) ?? null;
      if (incoming === known) continue;                          // our own change coming back, or nothing new
      const localRow = current.get(ch.collection)?.get(ch.id);
      const local = localRow === undefined ? null : this.json(localRow);
      if (local !== known) continue;                              // there is an unsaved local edit to this row: it will win when saved
      take.push(ch);
      let m = this.shadow.get(ch.collection);
      if (!m) this.shadow.set(ch.collection, (m = new Map()));
      if (incoming === null) m.delete(ch.id); else m.set(ch.id, incoming);
    }
    if (take.length) this.store.update((s) => applyChanges(s, take));
  }
}
