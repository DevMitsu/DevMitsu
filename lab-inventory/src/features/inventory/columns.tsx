import type { ReactNode } from 'react';
import { Badge } from '../../components/ui';
import { fmtDate, todayStr } from '../../domain/dates';
import { plain, toneFor } from '../../domain/fields';
import { expiryState, isLow, serviceState, stockValue } from '../../domain/inventory';
import type { AppState, FieldDef, Item } from '../../domain/types';

export interface ColCtx {
  state: AppState;
  out: Map<string, number>;
  today: string;
}

export interface Col {
  id: string;
  label: string;
  /** Plain value for sorting and CSV. */
  get: (i: Item, c: ColCtx) => string | number | undefined;
  cell: (i: Item, c: ColCtx) => ReactNode;
  right?: boolean;
  /** Shown in the picker under this heading. */
  group: 'Main' | 'Stock' | 'Safety' | 'Dates' | 'Category fields';
}

const dash = <span className="text-faint">—</span>;

export function expiryBadge(i: Item, c: ColCtx): ReactNode {
  if (!i.expiry) return dash;
  const st = expiryState(i, c.state.settings.expiryWarnDays, c.today);
  const tone = st === 'expired' ? 'red' : st === 'soon' ? 'amber' : undefined;
  return tone ? <Badge tone={tone}>{fmtDate(i.expiry)}{st === 'expired' ? ' · expired' : ''}</Badge> : <span className="whitespace-nowrap">{fmtDate(i.expiry)}</span>;
}

export function serviceBadge(i: Item, c: ColCtx): ReactNode {
  if (!i.nextServiceDue) return dash;
  const st = serviceState(i, c.state.settings.serviceWarnDays, c.today);
  const tone = st === 'overdue' ? 'red' : st === 'soon' ? 'amber' : undefined;
  return tone ? <Badge tone={tone}>{fmtDate(i.nextServiceDue)}{st === 'overdue' ? ' · overdue' : ''}</Badge> : <span className="whitespace-nowrap">{fmtDate(i.nextServiceDue)}</span>;
}

export function HazardBadges({ item, state }: { item: Item; state: Pick<AppState, 'lists'> }) {
  if (!item.hazards?.length) return dash;
  const f: FieldDef = { id: 'hazards', label: '', type: 'multiselect', listId: 'hazards' };
  return <span className="flex flex-wrap gap-1">{item.hazards.map((h) => <Badge key={h} tone={toneFor(state, f, h) ?? 'gray'}>{h}</Badge>)}</span>;
}

export function StatusBadge({ item, state }: { item: Item; state: Pick<AppState, 'lists'> }) {
  const t = toneFor(state, { id: 's', label: '', type: 'select', listId: 'itemStatus' }, item.status);
  return <Badge tone={t ?? 'gray'}>{item.status}</Badge>;
}

export function buildColumns(state: AppState): Col[] {
  const cat = (i: Item) => state.categories.find((c) => c.id === i.categoryId);
  const cols: Col[] = [
    { id: 'code', label: 'Code', group: 'Main', get: (i) => i.code, cell: (i) => <span className="font-mono text-xs whitespace-nowrap text-muted">{i.code}</span> },
    { id: 'name', label: 'Name', group: 'Main', get: (i) => i.name.toLowerCase(), cell: (i) => <span className="font-medium">{i.name}</span> },
    { id: 'category', label: 'Category', group: 'Main', get: (i) => cat(i)?.name ?? '', cell: (i) => <span className="text-muted">{cat(i)?.name}</span> },
    { id: 'lab', label: 'Lab', group: 'Main', get: (i) => state.labs.find((l) => l.id === i.labId)?.name ?? '', cell: (i) => {
      const l = state.labs.find((x) => x.id === i.labId);
      return l ? <span className="inline-flex items-center gap-1.5 text-muted"><span className="h-2 w-2 rounded-full" style={{ background: l.color }} />{l.short}</span> : dash;
    } },
    {
      id: 'quantity', label: 'In stock', group: 'Stock', right: true, get: (i) => i.quantity,
      cell: (i, c) => {
        const out = c.out.get(i.id) ?? 0;
        return (
          <span className="whitespace-nowrap tabular-nums">
            <b>{i.quantity}</b> <span className="text-muted">{i.unit}</span>
            {isLow(i) && <Badge tone={i.quantity <= 0 ? 'red' : 'amber'} className="ml-1.5">{i.quantity <= 0 ? 'Out' : 'Low'}</Badge>}
            {out > 0 && <span className="ml-1.5 text-xs text-muted">({out} out)</span>}
          </span>
        );
      },
    },
    { id: 'minStock', label: 'Reorder level', group: 'Stock', right: true, get: (i) => i.minStock, cell: (i) => (i.minStock != null ? <span className="tabular-nums">{i.minStock} {i.unit}</span> : dash) },
    { id: 'location', label: 'Location', group: 'Main', get: (i) => i.location ?? '', cell: (i) => (i.location ? <span>{i.location}</span> : dash) },
    { id: 'status', label: 'Status', group: 'Main', get: (i) => i.status, cell: (i) => <StatusBadge item={i} state={state} /> },
    { id: 'supplier', label: 'Supplier', group: 'Main', get: (i) => i.supplier ?? '', cell: (i) => (i.supplier ? <span>{i.supplier}</span> : dash) },
    { id: 'unitCost', label: 'Unit cost', group: 'Stock', right: true, get: (i) => i.unitCost, cell: (i) => (i.unitCost != null ? <span className="tabular-nums">{state.settings.currency}{i.unitCost}</span> : dash) },
    { id: 'value', label: 'Stock value', group: 'Stock', right: true, get: (i) => stockValue(i), cell: (i) => (i.unitCost != null ? <span className="tabular-nums">{state.settings.currency}{Math.round(stockValue(i)).toLocaleString('en-IN')}</span> : dash) },
    { id: 'expiry', label: 'Expiry', group: 'Dates', get: (i) => i.expiry ?? '9999', cell: (i, c) => expiryBadge(i, c) },
    { id: 'lot', label: 'Lot / batch', group: 'Dates', get: (i) => i.lot ?? '', cell: (i) => (i.lot ? <span>{i.lot}</span> : dash) },
    { id: 'purchaseDate', label: 'Purchased', group: 'Dates', get: (i) => i.purchaseDate ?? '', cell: (i) => (i.purchaseDate ? <span className="whitespace-nowrap">{fmtDate(i.purchaseDate)}</span> : dash) },
    { id: 'nextService', label: 'Next service', group: 'Dates', get: (i) => i.nextServiceDue ?? '9999', cell: (i, c) => serviceBadge(i, c) },
    { id: 'hazards', label: 'Hazards', group: 'Safety', get: (i) => (i.hazards ?? []).join(', '), cell: (i) => <HazardBadges item={i} state={state} /> },
    { id: 'storageGroup', label: 'Storage group', group: 'Safety', get: (i) => i.storageGroup ?? '', cell: (i) => (i.storageGroup ? <span>{i.storageGroup}</span> : dash) },
    { id: 'tags', label: 'Tags', group: 'Main', get: (i) => (i.tags ?? []).join(', '), cell: (i) => (i.tags?.length ? <span className="text-muted">{i.tags.join(', ')}</span> : dash) },
  ];
  // Every field any category defines becomes a column that can be switched on
  const seen = new Set<string>();
  for (const c of state.categories) {
    for (const f of c.fields) {
      const key = `cf:${f.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      cols.push({
        id: key, label: f.label, group: 'Category fields',
        get: (i) => plain(state, f, i.custom[f.id]),
        cell: (i) => {
          const v = plain(state, f, i.custom[f.id]);
          return v ? <span>{v}</span> : dash;
        },
      });
    }
  }
  return cols;
}

export const makeCtx = (state: AppState, out: Map<string, number>): ColCtx => ({ state, out, today: todayStr() });
