import { useSyncExternalStore } from 'react';
import type { Values } from '../domain/types';

/** Which editor dialog is open. Any screen can open them. */
export interface UiState {
  record?: { moduleId: string; id?: string; labId?: string; prefill?: Values };
  item?: { id?: string; labId?: string; categoryId?: string; duplicate?: boolean };
  receive?: string; // item id
  adjust?: string;
  transfer?: string;
  ret?: string; // loan record id to return
  receiveReq?: string; // requirement record id
  importLab?: string;
}

let ui: UiState = {};
const subs = new Set<() => void>();

export function setUi(patch: UiState) {
  ui = { ...ui, ...patch };
  subs.forEach((s) => s());
}
export function closeUi(...keys: (keyof UiState)[]) {
  const next = { ...ui };
  for (const k of keys) delete next[k];
  ui = next;
  subs.forEach((s) => s());
}
export function useUi(): UiState {
  return useSyncExternalStore((l) => { subs.add(l); return () => subs.delete(l); }, () => ui);
}

export const openRecord = (moduleId: string, o: { id?: string; labId?: string; prefill?: Values } = {}) => setUi({ record: { moduleId, ...o } });
export const openItem = (o: { id?: string; labId?: string; categoryId?: string; duplicate?: boolean } = {}) => setUi({ item: o });
