import { useSyncExternalStore } from 'react';
import { buildEmpty, buildSeed, STATE_VERSION } from '../data/seed';
import { isConnected } from '../sync/config';
import type { AppState } from '../domain/types';

const KEY = 'alexandria-demo';

function load(): AppState {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed.version === STATE_VERSION) return parsed;
    }
  } catch {
    /* storage unavailable or corrupt: start from the demo data */
  }
  return buildSeed();
}

const DEVICE_KEY = 'alexandria-device';
/** When connected to the shared database, only this device's own settings are kept locally. */
function loadDevice(): AppState {
  const base = { ...buildEmpty(), activeLibrary: 'sr' as const };
  try {
    const raw = window.localStorage.getItem(DEVICE_KEY);
    if (raw) { const d = JSON.parse(raw); return { ...base, prefs: { ...base.prefs, ...d.prefs }, activeLibrary: d.activeLibrary ?? 'sr' }; }
  } catch { /* use defaults */ }
  return base;
}

let state: AppState = isConnected ? loadDevice() : load();
let undoSnapshot: UndoSnapshot | null = null;
const listeners = new Set<() => void>();

export interface UndoSnapshot {
  label: string;
  /** Reverses only what that transaction changed, so other devices' newer changes are kept. */
  revert: (s: AppState) => AppState;
}

export const getState = () => state;

export const getUndo = () => undoSnapshot;

let persistTimer: number | undefined;
function persist(immediate = false) {
  const write = () => {
    try {
      window.localStorage.setItem(isConnected ? DEVICE_KEY : KEY, JSON.stringify(isConnected ? { prefs: state.prefs, activeLibrary: state.activeLibrary } : state));
    } catch {
      /* ignore: the app keeps working in memory */
    }
  };
  if (immediate) return write();
  window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(write, 250);
}

persist(true);

export function setState(update: (s: AppState) => AppState) {
  state = update(state);
  persist();
  listeners.forEach((l) => l());
}

export function setUndo(snapshot: UndoSnapshot | null) {
  undoSnapshot = snapshot;
  listeners.forEach((l) => l());
}

export function replaceState(next: AppState) {
  undoSnapshot = null;
  setState(() => next);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Select a slice. Selectors must return existing references (no new objects) to stay stable. */
export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state));
}
export const useUndo = () => useSyncExternalStore(subscribe, () => undoSnapshot);

/** What the sync engine uses to read and replace the app's data. */
export const storeApi = {
  get: () => state,
  set(next: AppState) { undoSnapshot = null; state = next; persist(); listeners.forEach((l) => l()); },
  update: (fn: (s: AppState) => AppState) => setState(fn),
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
};
