import { useSyncExternalStore } from 'react';
import type { SyncStatus } from './engine';

export interface SyncState {
  status: SyncStatus;
  detail?: string;
  /** True once the first load from the shared database has finished. */
  loaded: boolean;
}
let state: SyncState = { status: 'connecting', loaded: false };
const listeners = new Set<() => void>();
export const getSyncState = () => state;
export function setSyncState(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
export const useSyncState = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state);
