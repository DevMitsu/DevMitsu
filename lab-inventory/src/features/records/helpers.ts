import type { LabRecord, ModuleDef } from '../../domain/types';

/** The date (or moment) an entry is about, taken from the form's date field. */
export function recordDate(m: ModuleDef | undefined, r: LabRecord): string {
  const v = m ? r.values[m.dateFieldId] : undefined;
  return typeof v === 'string' && v ? v : r.createdAt;
}

export function recordDay(m: ModuleDef | undefined, r: LabRecord): string {
  return recordDate(m, r).slice(0, 10);
}

export function mentionsItem(r: LabRecord, itemId: string): boolean {
  if (r.values.item === itemId) return true;
  const many = r.values.items;
  return Array.isArray(many) && many.includes(itemId);
}

/** A one-line description of an entry, for lists and activity. */
export function recordTitle(m: ModuleDef | undefined, r: LabRecord, itemName?: string): string {
  const v = r.values;
  const bits = [itemName, v.name, v.title, v.type, v.topic, v.substance].filter((x) => typeof x === 'string' && x) as string[];
  return bits[0] ?? m?.singular ?? 'Entry';
}
