import { daysBetween } from './dates';
import { num } from './fields';
import type { AppState, Category, Item, Lab, LabRecord, ModuleDef, TxnType, Values } from './types';

export const ALL = 'all';

export function activeLabs(s: Pick<AppState, 'labs'>): Lab[] {
  return s.labs.filter((l) => !l.archived);
}

export function labOf(s: Pick<AppState, 'labs'>, id: string): Lab | undefined {
  return s.labs.find((l) => l.id === id);
}

export function categoriesForLab(s: Pick<AppState, 'categories'>, labId: string): Category[] {
  return s.categories.filter((c) => !c.archived && (labId === ALL || c.labIds.length === 0 || c.labIds.includes(labId)));
}

export function modulesForLab(s: Pick<AppState, 'modules'>, labId: string): ModuleDef[] {
  return s.modules
    .filter((m) => m.enabled && (labId === ALL || m.labIds.length === 0 || m.labIds.includes(labId)))
    .sort((a, b) => a.order - b.order);
}

export function itemsOfLab(s: Pick<AppState, 'items'>, labId: string, includeArchived = false): Item[] {
  return s.items.filter((i) => (labId === ALL || i.labId === labId) && (includeArchived || !i.archived));
}

export function isOpenLoan(r: LabRecord): boolean {
  return r.moduleId === 'loan' && !r.values.returned;
}

/** Units of each item that are currently out on loan. */
export function outOnLoan(records: LabRecord[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of records) {
    if (!isOpenLoan(r)) continue;
    const id = r.values.item as string;
    if (id) m.set(id, (m.get(id) ?? 0) + (num(r.values.quantity) ?? 0));
  }
  return m;
}

export function isLow(i: Item): boolean {
  return i.minStock != null && i.minStock > 0 && i.quantity <= i.minStock;
}

export function stockValue(i: Item): number {
  return (i.unitCost ?? 0) * Math.max(0, i.quantity);
}

export function expiryState(i: Item, warnDays: number, today: string): 'expired' | 'soon' | 'ok' | 'none' {
  if (!i.expiry) return 'none';
  const d = daysBetween(today, i.expiry);
  if (d < 0) return 'expired';
  return d <= warnDays ? 'soon' : 'ok';
}

export function serviceState(i: Item, warnDays: number, today: string): 'overdue' | 'soon' | 'ok' | 'none' {
  if (!i.nextServiceDue) return 'none';
  const d = daysBetween(today, i.nextServiceDue);
  if (d < 0) return 'overdue';
  return d <= warnDays ? 'soon' : 'ok';
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Next free item code for a lab + category, following the code format in settings. */
export function nextCode(s: AppState, labId: string, categoryId: string): string {
  const lab = labOf(s, labId);
  const cat = s.categories.find((c) => c.id === categoryId);
  const fmt = s.settings.codeFormat || '{LAB}-{CAT}-{NNNN}';
  const lead = (x: string) => x.replace('{LAB}', lab?.short ?? 'LAB').replace('{CAT}', cat?.codePrefix ?? 'ITM');
  const pattern = fmt
    .split(/(\{NNNN\})/)
    .map((part) => (part === '{NNNN}' ? '(\\d+)' : escapeRe(lead(part))))
    .join('');
  const re = new RegExp(`^${pattern}$`, 'i');
  let max = 0;
  for (const i of s.items) {
    const m = re.exec(i.code);
    if (m) max = Math.max(max, Number(m[1]));
  }
  const n = String(max + 1).padStart(4, '0');
  return lead(fmt).replace('{NNNN}', n);
}

/** What a record does to stock, if anything. */
export function stockEffect(m: ModuleDef, v: Values): { itemId: string; qty: number; type: TxnType } | null {
  const itemId = v.item as string | undefined;
  const qty = num(v.quantity);
  if (!itemId || !qty || qty <= 0) return null;
  switch (m.kind) {
    case 'usage':
      return { itemId, qty, type: 'use' };
    case 'spill':
      return v.deduct === false ? null : { itemId, qty, type: 'spill' };
    case 'breakage':
      return { itemId, qty, type: 'breakage' };
    case 'disposal':
      return { itemId, qty, type: 'dispose' };
    default:
      return null;
  }
}

export const TXN_LABEL: Record<TxnType, string> = {
  opening: 'Opening stock',
  receive: 'Received',
  use: 'Used',
  spill: 'Spilled',
  breakage: 'Broken / lost',
  dispose: 'Disposed',
  adjust: 'Adjusted',
  stocktake: 'Stocktake',
  'transfer-out': 'Transferred out',
  'transfer-in': 'Transferred in',
  correction: 'Correction',
};
