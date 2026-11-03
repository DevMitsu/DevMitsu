import { RemoteError, type Op, type Remote } from './engine';
import type { Change, RemoteRecord } from './records';

/**
 * A stand-in database that lives in this browser and is shared by every tab of it.
 * It behaves like the real one (all-or-nothing saves, the same uniqueness rules, live updates),
 * so sync can be tried and tested without a Supabase project.
 */
const KEY = 'alx-memory-records';
const read = (): Record<string, unknown> => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { return {}; } };
const isDF = (d: { type?: string }) => (d.type ?? '').toUpperCase() === 'DF';

export class MemoryRemote implements Remote {
  private channel = new BroadcastChannel('alx-memory');
  private own = new Set<(c: Change[]) => void>();
  /** Test hook: how long a save takes, in ms. */
  delay = 0;

  async loadAll(): Promise<RemoteRecord[]> {
    return Object.entries(read()).map(([k, data]) => { const i = k.indexOf('|'); return { collection: k.slice(0, i), id: k.slice(i + 1), data }; });
  }

  async apply(ops: Op[]): Promise<void> {
    const wait = (globalThis as { __alxApplyDelay?: number }).__alxApplyDelay ?? this.delay;   // test hook: slow this device's saves
    if (wait) await new Promise((r) => setTimeout(r, wait));
    const db = read() as Record<string, { bookId?: string; returnedOn?: string; accession?: number; type?: string }>;
    const next = { ...db };
    for (const op of ops) {
      const key = `${op.c}|${op.id}`;
      if (op.d === null) { delete next[key]; continue; }
      const d = op.d as { bookId?: string; returnedOn?: string; accession?: number; type?: string };
      if (op.c === 'loans' && !d.returnedOn) {
        const clash = Object.entries(next).find(([k, v]) => k.startsWith('loans|') && k !== key && !v.returnedOn && v.bookId === d.bookId);
        if (clash) throw new RemoteError('conflict', 'duplicate key value violates unique constraint "one_open_loan_per_book"');
      }
      if (op.c === 'books') {
        const clash = Object.entries(next).find(([k, v]) => k.startsWith('books|') && k !== key && v.accession === d.accession && isDF(v) === isDF(d));
        if (clash) throw new RemoteError('conflict', 'duplicate key value violates unique constraint "unique_accession_per_series"');
      }
      next[key] = op.d as never;
    }
    localStorage.setItem(KEY, JSON.stringify(next));
    const changes: Change[] = ops.map((o) => ({ collection: o.c, id: o.id, data: o.d }));
    this.channel.postMessage(changes);
    setTimeout(() => this.own.forEach((cb) => cb(changes)), 0);   // the real database also tells the sender
  }

  subscribe(onChange: (c: Change[]) => void, onConnection: (up: boolean) => void): () => void {
    const handler = (e: MessageEvent) => onChange(e.data as Change[]);
    this.channel.addEventListener('message', handler);
    this.own.add(onChange);
    onConnection(true);
    return () => { this.channel.removeEventListener('message', handler); this.own.delete(onChange); };
  }
}
