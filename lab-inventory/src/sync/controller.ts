import { notify } from '../components/toast';
import { emptyState } from '../domain/defaults';
import { readLocalSaved, setLocalSavedAside, storeApi } from '../store/store';
import type { AppState } from '../domain/types';
import { config } from './config';
import { SyncEngine, type Remote } from './engine';
import { MemoryRemote } from './memoryRemote';
import { setSyncState } from './status';
import { SupabaseRemote } from './supabaseRemote';

let engine: SyncEngine | null = null;
const ADOPTING = 'labinventory.adopting';

/** The state to start from: empty data, but this computer's own preferences. */
function base(): AppState {
  const e = emptyState();
  const s = storeApi.get().settings;
  return { ...e, settings: { ...e.settings, theme: s.theme, textSize: s.textSize, compact: s.compact, currentUser: s.currentUser, lastBackupAt: s.lastBackupAt, itemColumns: s.itemColumns } };
}

/** Starts live sync. Call after sign-in. */
export async function startSync() {
  if (!config || engine) return;
  const remote: Remote = config.mode === 'memory' ? new MemoryRemote() : new SupabaseRemote();
  const e = new SyncEngine(
    remote,
    storeApi,
    base,
    (status, detail) => setSyncState({ status, detail }),
    (message) => notify(message, 'error'),
  );
  engine = e;
  try {
    const local = readLocalSaved(); // data this computer kept on its own before being connected
    const resuming = !!local && localStorage.getItem(ADOPTING) === '1';
    if (local && !resuming) localStorage.setItem(ADOPTING, '1');
    const outcome = await e.start(local ?? undefined, resuming);
    if (outcome === 'adopted') {
      await e.settle(); // only set the local copy aside once it is safely in the shared database
      if (!e.hasUnsaved()) {
        localStorage.removeItem(ADOPTING);
        setLocalSavedAside();
        notify('This computer’s lab data is now the shared data, and everyone who signs in will see it.', 'info');
      }
    } else if (outcome === 'loaded' && local) {
      localStorage.removeItem(ADOPTING);
      setLocalSavedAside();
      notify('The shared data was loaded. The data this computer had on its own was set aside: Customise → Data & backup can restore it.', 'info');
    }
    setSyncState({ loaded: true });
  } catch (err) {
    engine = null;
    setSyncState({ status: 'error', detail: err instanceof Error ? err.message : String(err), loaded: false });
  }
}

// Never lose typed work silently: save as soon as the page is hidden, and warn before closing with unsaved changes.
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') engine?.saveNow(); });
  window.addEventListener('beforeunload', (e) => {
    if (engine?.hasUnsaved()) { engine.saveNow(); e.preventDefault(); e.returnValue = ''; }
  });
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
