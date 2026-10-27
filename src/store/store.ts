import { useSyncExternalStore } from 'react';
import { buildSeed, STATE_VERSION } from '../data/seed';
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

let state: AppState = load();
let undoSnapshot: UndoSnapshot | null = null;
const listeners = new Set<() => void>();

export interface UndoSnapshot {
  label: string;
  slices: Pick<AppState, 'books' | 'loans' | 'pending' | 'fines' | 'events'>;
}

export const getState = () => state;

export const getUndo = () => undoSnapshot;

function persist() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore: the app keeps working in memory */
  }
}

persist();

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
