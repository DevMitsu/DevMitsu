import { num } from './fields';
import type { AppState, LabRecord, Item } from './types';

export type FineStatus = 'Pending' | 'Paid' | 'Waived';

export function breakageModuleId(s: Pick<AppState, 'modules'>): string | undefined {
  return s.modules.find((m) => m.kind === 'breakage')?.id;
}

/** Breakage entries that carry a fine. */
export function finedRecords(s: Pick<AppState, 'records' | 'modules'>): LabRecord[] {
  const id = breakageModuleId(s);
  return id ? s.records.filter((r) => r.moduleId === id && (num(r.values.fine) ?? 0) > 0) : [];
}

export const fineStatusOf = (r: LabRecord): FineStatus => (r.values.fineStatus as FineStatus) || 'Pending';

/** What a fine would be for breaking `qty` of an item, from its cost and the school's fine percentage. */
export function suggestedFine(item: Pick<Item, 'unitCost'> | undefined, qty: number, percent: number): number | undefined {
  if (!item?.unitCost || !(qty > 0)) return undefined;
  return Math.round(item.unitCost * qty * (percent / 100) * 100) / 100;
}

export function fineTotals(records: LabRecord[]) {
  let pending = 0, paid = 0, waived = 0;
  for (const r of records) {
    const v = num(r.values.fine) ?? 0;
    const st = fineStatusOf(r);
    if (st === 'Paid') paid += v;
    else if (st === 'Waived') waived += v;
    else pending += v;
  }
  return { pending, paid, waived };
}
