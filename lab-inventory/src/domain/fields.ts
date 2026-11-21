import { fmtDate, fmtDateTime, nowStr, todayStr } from './dates';
import type { AppState, FieldDef, Tone, Value, Values } from './types';

export function isEmpty(v: Value): boolean {
  return v == null || v === '' || (Array.isArray(v) && v.length === 0);
}

export function optionsFor(state: Pick<AppState, 'lists'>, field: FieldDef): string[] {
  if (field.listId) return state.lists.find((l) => l.id === field.listId)?.options ?? [];
  return field.options ?? [];
}

export function toneFor(state: Pick<AppState, 'lists'>, field: FieldDef | undefined, value: string): Tone | undefined {
  if (!field?.listId) return undefined;
  return state.lists.find((l) => l.id === field.listId)?.tones?.[value];
}

export function defaultValues(fields: FieldDef[]): Values {
  const v: Values = {};
  for (const f of fields) {
    if (f.default === '@today') v[f.id] = todayStr();
    else if (f.default === '@now') v[f.id] = nowStr();
    else if (f.default !== undefined) v[f.id] = f.default;
  }
  return v;
}

export function num(v: Value): number | undefined {
  if (v == null || v === '' || typeof v === 'boolean' || Array.isArray(v)) return undefined;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

export function str(v: Value): string {
  if (v == null) return '';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

/** Returns { fieldId: message } for every problem found. */
export function validate(fields: FieldDef[], values: Values): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    if (f.hidden) continue;
    const v = values[f.id];
    if (f.required && f.type !== 'checkbox' && isEmpty(v)) {
      errors[f.id] = 'Required';
      continue;
    }
    if ((f.type === 'number' || f.type === 'money') && !isEmpty(v)) {
      const n = num(v);
      if (n === undefined) errors[f.id] = 'Enter a number';
      else if (n < 0) errors[f.id] = 'Cannot be negative';
    }
  }
  return errors;
}

/** A readable, plain-text rendering of one value (CSV, search, print). */
export function plain(state: AppState, f: FieldDef, v: Value): string {
  if (isEmpty(v)) return '';
  switch (f.type) {
    case 'date':
      return fmtDate(String(v));
    case 'datetime':
      return fmtDateTime(String(v));
    case 'checkbox':
      return v ? 'Yes' : 'No';
    case 'item':
      return state.items.find((i) => i.id === v)?.name ?? '(removed item)';
    case 'items':
      return (Array.isArray(v) ? v : [])
        .map((id) => state.items.find((i) => i.id === id)?.name ?? '(removed item)')
        .join(', ');
    case 'multiselect':
      return Array.isArray(v) ? v.join(', ') : String(v);
    case 'number':
      return `${v}${f.unit ? ` ${f.unit}` : ''}`;
    case 'money':
      return `${state.settings.currency}${num(v) ?? v}`;
    default:
      return str(v);
  }
}
