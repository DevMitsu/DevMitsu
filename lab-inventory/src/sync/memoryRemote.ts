import { RemoteError, type Op, type Remote } from './engine';
import type { Change, RemoteRecord } from './records';

/**
 * A stand-in database that lives in this browser and is shared by every tab of it.
 * It behaves like the real one (all-or-nothing saves, live updates to every tab), so sync can be tried and tested
 * without a Supabase project. Turn it on with config { mode: 'memory' }.
 */
const KEY = 'labinventory-memory-records';
const read = (): Record<string, unknown> => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { return {}; } };

export class MemoryRemote implements Remote {
  private channel = new BroadcastChannel('labinventory-memory');
  private own = new Set<(c: Change[]) => void>();

  async loadAll(): Promise<RemoteRecord[]> {
    return Object.entries(read()).map(([k, data]) => { const i = k.indexOf('|'); return { collection: k.slice(0, i), id: k.slice(i + 1), data }; });
  }

  async apply(ops: Op[]): Promise<void> {
    if ((globalThis as { __labOffline?: boolean }).__labOffline) throw new RemoteError('network', 'Failed to fetch'); // test hook: pretend the internet is down
    const wait = (globalThis as { __labApplyDelay?: number }).__labApplyDelay ?? 0; // test hook: slow this computer's saves
    if (wait) await new Promise((r) => setTimeout(r, wait));
    const next = { ...read() };
    for (const op of ops) {
      const key = `${op.c}|${op.id}`;
      if (op.d === null) delete next[key];
      else next[key] = op.d as never;
    }
    localStorage.setItem(KEY, JSON.stringify(next));
    const changes: Change[] = ops.map((o) => ({ collection: o.c, id: o.id, data: o.d }));
    this.channel.postMessage(changes);
    setTimeout(() => this.own.forEach((cb) => cb(changes)), 0); // the real database also tells the sender
  }

  subscribe(onChange: (c: Change[]) => void, onConnection: (up: boolean) => void): () => void {
    const handler = (e: MessageEvent) => onChange(e.data as Change[]);
    this.channel.addEventListener('message', handler);
    this.own.add(onChange);
    onConnection(true);
    return () => { this.channel.removeEventListener('message', handler); this.own.delete(onChange); };
  }
}
