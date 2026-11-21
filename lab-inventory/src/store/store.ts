import { produce, type Draft } from 'immer';
import { useSyncExternalStore } from 'react';
import { emptyState, migrate } from '../domain/defaults';
import { stamp } from '../domain/dates';
import { uid } from '../domain/ids';
import type { AppState } from '../domain/types';

const KEY = 'labinventory.data.v1';
const MAX_UNDO = 40;
const MAX_ACTIVITY = 600;

// ------------------------------------------------------------ persistence

let initialChars = 0;

function read(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    initialChars = raw.length;
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed || !Array.isArray(parsed.items) || !Array.isArray(parsed.labs)) throw new Error('shape');
    return migrate(parsed);
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
let past: AppState[] = [];
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
let undoLabels: string[] = [];
const metaListeners = new Set<() => void>();
function setMeta(p: Partial<Meta>) {
  meta = { ...meta, ...p };
  metaListeners.forEach((l) => l());
}

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
    const json = JSON.stringify(state);
    localStorage.setItem(KEY, json);
    dirty = false;
    setMeta({ saveError: '', lastSavedAt: Date.now(), usedChars: json.length });
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
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY || e.newValue == null) return;
    try {
      state = migrate(JSON.parse(e.newValue) as AppState);
      past = [];
      undoLabels = [];
      setMeta({ canUndo: false, undoLabel: '' });
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
    past.push(state);
    undoLabels.push(label);
    if (past.length > MAX_UNDO) {
      past.shift();
      undoLabels.shift();
    }
  }
  state = next;
  listeners.forEach((l) => l());
  setMeta({ canUndo: past.length > 0, undoLabel: undoLabels[undoLabels.length - 1] ?? '' });
  scheduleSave();
  return result;
}

export function undo(): string | null {
  const prev = past.pop();
  const label = undoLabels.pop() ?? '';
  if (!prev) return null;
  state = prev;
  listeners.forEach((l) => l());
  setMeta({ canUndo: past.length > 0, undoLabel: undoLabels[undoLabels.length - 1] ?? '' });
  scheduleSave();
  return label;
}

/** Replace everything (restore a backup, start over). Clears undo. */
export function replaceState(next: AppState) {
  state = migrate(next);
  past = [];
  undoLabels = [];
  listeners.forEach((l) => l());
  setMeta({ canUndo: false, undoLabel: '' });
  scheduleSave();
  flushSave();
}

export function exportJSON(): string {
  return JSON.stringify(state, null, 1);
}
