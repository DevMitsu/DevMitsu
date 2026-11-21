import { produce, type Draft } from 'immer';
import { useSyncExternalStore } from 'react';
import { DEFAULT_SETTINGS, emptyState, migrate } from '../domain/defaults';
import { stamp } from '../domain/dates';
import { uid } from '../domain/ids';
import type { AppState, Settings } from '../domain/types';
import { isConnected } from '../sync/config';
import type { StoreApi } from '../sync/engine';

const KEY = 'labinventory.data.v1';
const PREFS_KEY = 'labinventory.prefs.v1';
export const BEFORE_SYNC_KEY = `${KEY}.before-sync`;
const MAX_UNDO = 40;
const MAX_ACTIVITY = 600;

/** Settings that belong to one computer, not to the school. They are never shared. */
const DEVICE_SETTINGS = ['theme', 'textSize', 'compact', 'currentUser', 'lastBackupAt', 'itemColumns'] as const satisfies readonly (keyof Settings)[];

/**
 * Shared mode: the data lives in the shared database and this computer keeps no copy of it
 * (a lab PC should not hold the school's records after someone signs out). Only this computer's preferences are kept.
 */
const persistData = !isConnected;

// ------------------------------------------------------------ persistence

function readPrefs(): Partial<Settings> {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<Settings>;
  } catch {
    return {};
  }
}

function parseSaved(raw: string): AppState {
  const parsed = JSON.parse(raw) as AppState;
  if (!parsed || !Array.isArray(parsed.items) || !Array.isArray(parsed.labs)) throw new Error('shape');
  return migrate(parsed);
}

let initialChars = 0;

function read(): AppState {
  if (!persistData) {
    const e = emptyState();
    return { ...e, settings: { ...e.settings, ...readPrefs() } };
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    initialChars = raw.length;
    return parseSaved(raw);
  } catch {
    // Keep whatever was there so it can be recovered, then start clean rather than crash.
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) localStorage.setItem(`${KEY}.corrupt.${Date.now()}`, raw);
    } catch {
      /* storage unavailable */
    }
    return emptyState();
  }
}

let state: AppState = read();
let past: { state: AppState; label: string }[] = [];
const listeners = new Set<() => void>();

// Small separate store for things that are about the app, not the data.
interface Meta {
  canUndo: boolean;
  undoLabel: string;
  saveError: string;
  lastSavedAt: number;
  /** Characters of browser storage the saved data takes. Browsers allow about 5 million. */
  usedChars: number;
}
export const STORAGE_LIMIT_CHARS = 5_000_000;
let meta: Meta = { canUndo: false, undoLabel: '', saveError: '', lastSavedAt: 0, usedChars: initialChars };
const metaListeners = new Set<() => void>();
function setMeta(p: Partial<Meta>) {
  meta = { ...meta, ...p };
  metaListeners.forEach((l) => l());
}
const syncUndoMeta = () => setMeta({ canUndo: past.length > 0, undoLabel: past[past.length - 1]?.label ?? '' });

let timer: ReturnType<typeof setTimeout> | undefined;
let dirty = false;

function save() {
  timer = undefined;
  if (!dirty) return;
  if (typeof localStorage === 'undefined') {
    dirty = false;
    return;
  }
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(Object.fromEntries(DEVICE_SETTINGS.map((k) => [k, state.settings[k]]))));
    if (persistData) {
      const json = JSON.stringify(state);
      localStorage.setItem(KEY, json);
      setMeta({ usedChars: json.length });
    }
    dirty = false;
    setMeta({ saveError: '', lastSavedAt: Date.now() });
  } catch (e) {
    setMeta({
      saveError:
        'This browser could not save your data (storage may be full or blocked). Download a backup from Customise → Data now.',
    });
    console.error(e);
  }
}

export function flushSave() {
  if (timer) clearTimeout(timer);
  save();
}

function scheduleSave() {
  dirty = true;
  if (timer) clearTimeout(timer);
  timer = setTimeout(save, 250);
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushSave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSave();
  });
  // Another tab changed the data: take its version so the two tabs never overwrite each other.
  // (In shared mode the database does this job.)
  window.addEventListener('storage', (e) => {
    if (!persistData || e.key !== KEY || e.newValue == null) return;
    try {
      state = migrate(JSON.parse(e.newValue) as AppState);
      past = [];
      syncUndoMeta();
      listeners.forEach((l) => l());
    } catch {
      /* ignore */
    }
  });
}

// ------------------------------------------------------------ access

export function getState(): AppState {
  return state;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Subscribe to a slice. The selector must return a stable reference (a slice of state, not a fresh array). */
export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
}

export function useMeta(): Meta {
  return useSyncExternalStore(
    (l) => {
      metaListeners.add(l);
      return () => metaListeners.delete(l);
    },
    () => meta,
  );
}

// ------------------------------------------------------------ changing

interface MutateOptions {
  /** Shown in the activity feed. Omit for changes that are not worth listing. */
  log?: string;
  labId?: string;
  /** Do not offer undo for this change. */
  noUndo?: boolean;
}

/**
 * The only way data changes. `fn` edits a draft; if it throws, nothing is changed.
 * Every change can be undone and is saved automatically.
 */
export function mutate<T>(label: string, fn: (d: Draft<AppState>) => T, opts: MutateOptions = {}): T {
  let result!: T;
  const next = produce(state, (d) => {
    result = fn(d);
    if (opts.log) {
      d.activity.unshift({ id: uid('a'), at: stamp(), by: d.settings.currentUser || undefined, labId: opts.labId, text: opts.log });
      if (d.activity.length > MAX_ACTIVITY) d.activity.length = MAX_ACTIVITY;
    }
  });
  if (next === state) return result;
  if (!opts.noUndo) {
    past.push({ state, label });
    if (past.length > MAX_UNDO) past.shift();
  }
  state = next;
  listeners.forEach((l) => l());
  syncUndoMeta();
  scheduleSave();
  return result;
}

/**
 * Undoes the last change. Returns its label, or null if there is nothing to undo.
 * In shared mode an undo is only possible until a change from another computer arrives, because going back to an
 * older snapshot would also undo what other people did in the meantime.
 */
export function undo(): string | null {
  const prev = past.pop();
  if (!prev) return null;
  state = prev.state;
  listeners.forEach((l) => l());
  syncUndoMeta();
  scheduleSave();
  return prev.label;
}

/** Replace everything (restore a backup, start over). Clears undo. */
export function replaceState(next: AppState) {
  state = migrate(next);
  past = [];
  listeners.forEach((l) => l());
  syncUndoMeta();
  scheduleSave();
  flushSave();
}

export function exportJSON(): string {
  return JSON.stringify(state, null, 1);
}

// ------------------------------------------------------------ shared mode

/** What the sync engine uses to read and change the app's data. */
export const storeApi: StoreApi = {
  get: getState,
  set(next) {
    state = migrate(next);
    past = [];
    listeners.forEach((l) => l());
    syncUndoMeta();
    scheduleSave();
  },
  update(fn) {
    state = fn(state);
    past = []; // see undo(): older snapshots no longer include what just arrived
    listeners.forEach((l) => l());
    syncUndoMeta();
    scheduleSave();
  },
  subscribe,
};

/** The record this computer kept before it was connected to the shared database, if there is one with data in it. */
export function readLocalSaved(): AppState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = parseSaved(raw);
    return s.setupDone && (s.items.length || s.records.length) ? s : null;
  } catch {
    return null;
  }
}

/** Sets the old local copy aside so it is neither lost nor adopted a second time. */
export function setLocalSavedAside() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      localStorage.setItem(BEFORE_SYNC_KEY, raw);
      localStorage.removeItem(KEY);
    }
  } catch {
    /* ignore */
  }
}

/** The copy that was set aside, for "restore what this computer had before". */
export function readBeforeSync(): AppState | null {
  try {
    const raw = localStorage.getItem(BEFORE_SYNC_KEY);
    return raw ? parseSaved(raw) : null;
  } catch {
    return null;
  }
}

/** Writes the current data as this computer's own copy, so it keeps working on its own after disconnecting. */
export function saveCurrentAsLocal() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

/** Removes this computer's copy of data (after signing out of the shared database). */
export function wipeLocalData() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export { DEFAULT_SETTINGS };
