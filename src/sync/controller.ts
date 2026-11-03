import { buildEmpty } from '../data/seed';
import { toast } from '../components/ui/toast';
import { storeApi } from '../store/store';
import { config } from './config';
import { SyncEngine, type Remote } from './engine';
import { MemoryRemote } from './memoryRemote';
import { setSyncState } from './status';
import { SupabaseRemote } from './supabaseRemote';

let engine: SyncEngine | null = null;
const base = buildEmpty();

/** Starts live sync. Call after sign-in. */
export async function startSync() {
  if (!config || engine) return;
  const remote: Remote = config.mode === 'memory' ? new MemoryRemote() : new SupabaseRemote();
  const e = new SyncEngine(
    remote,
    storeApi,
    () => ({ ...base, prefs: storeApi.get().prefs, activeLibrary: storeApi.get().activeLibrary }),
    (status, detail) => setSyncState({ status, detail }),
    (message) => toast(message, { tone: 'error', ms: 10_000 }),
  );
  engine = e;
  try {
    await e.start();
    setSyncState({ loaded: true });
  } catch (err) {
    engine = null;
    setSyncState({ status: 'error', detail: err instanceof Error ? err.message : String(err), loaded: false });
  }
}

export async function stopSync() {
  if (!engine) return;
  try { await engine.settle(); } catch { /* signing out anyway */ }
  engine.stop();
  engine = null;
  setSyncState({ status: 'connecting', loaded: false, detail: undefined });
}

export const syncNow = async () => { await engine?.settle(); };
export const getEngine = () => engine;
