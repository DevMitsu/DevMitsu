import { daysBetween, fmtDate, todayStr } from './dates';
import { expiryState, isLow, isOpenLoan, serviceState } from './inventory';
import { num } from './fields';
import type { AppState } from './types';

export type AlertKind =
  | 'out-of-stock'
  | 'low-stock'
  | 'expired'
  | 'expiring'
  | 'service-overdue'
  | 'service-soon'
  | 'loan-overdue'
  | 'accident-open'
  | 'followup-due'
  | 'storage-conflict'
  | 'requirement-urgent';

export interface Alert {
  id: string;
  kind: AlertKind;
  severity: 'high' | 'medium' | 'low';
  labId: string;
  title: string;
  detail: string;
  /** Route below the lab scope, e.g. "items/abc". */
  to: string;
  itemId?: string;
}

export const ALERT_LABEL: Record<AlertKind, string> = {
  'out-of-stock': 'Out of stock',
  'low-stock': 'Low stock',
  expired: 'Expired',
  expiring: 'Expiring soon',
  'service-overdue': 'Service overdue',
  'service-soon': 'Service due soon',
  'loan-overdue': 'Overdue loan',
  'accident-open': 'Open accident',
  'followup-due': 'Follow-up due',
  'storage-conflict': 'Storage conflict',
  'requirement-urgent': 'Urgent requirement',
};

export function computeAlerts(s: AppState, today = todayStr()): Alert[] {
  const out: Alert[] = [];
  const { expiryWarnDays, serviceWarnDays } = s.settings;

  for (const i of s.items) {
    if (i.archived) continue;
    const cat = s.categories.find((c) => c.id === i.categoryId);
    const unit = i.unit;

    if (i.minStock != null && i.minStock > 0) {
      if (i.quantity <= 0) {
        out.push({ id: `oos-${i.id}`, kind: 'out-of-stock', severity: 'high', labId: i.labId, itemId: i.id, to: `items/${i.id}`, title: `${i.name} is out of stock`, detail: `Reorder level is ${i.minStock} ${unit}` });
      } else if (isLow(i)) {
        out.push({ id: `low-${i.id}`, kind: 'low-stock', severity: 'medium', labId: i.labId, itemId: i.id, to: `items/${i.id}`, title: `${i.name} is running low`, detail: `${i.quantity} ${unit} left (reorder level ${i.minStock})` });
      }
    }

    if (cat?.trackExpiry && i.quantity > 0) {
      const e = expiryState(i, expiryWarnDays, today);
      if (e === 'expired') out.push({ id: `exp-${i.id}`, kind: 'expired', severity: 'high', labId: i.labId, itemId: i.id, to: `items/${i.id}`, title: `${i.name} has expired`, detail: `Expired ${fmtDate(i.expiry)}. Dispose of it or extend its date after testing.` });
      else if (e === 'soon') out.push({ id: `exs-${i.id}`, kind: 'expiring', severity: 'medium', labId: i.labId, itemId: i.id, to: `items/${i.id}`, title: `${i.name} expires soon`, detail: `Expires ${fmtDate(i.expiry)} (${daysBetween(today, i.expiry!)} days)` });
    }

    const sv = serviceState(i, serviceWarnDays, today);
    if (sv === 'overdue') out.push({ id: `svo-${i.id}`, kind: 'service-overdue', severity: 'high', labId: i.labId, itemId: i.id, to: `items/${i.id}`, title: `${i.name}: service overdue`, detail: `Was due ${fmtDate(i.nextServiceDue)}` });
    else if (sv === 'soon') out.push({ id: `svs-${i.id}`, kind: 'service-soon', severity: 'low', labId: i.labId, itemId: i.id, to: `items/${i.id}`, title: `${i.name}: service due soon`, detail: `Due ${fmtDate(i.nextServiceDue)}` });
  }

  const itemName = (id: unknown) => s.items.find((i) => i.id === id)?.name ?? 'item';

  for (const r of s.records) {
    const m = s.modules.find((x) => x.id === r.moduleId);
    if (!m || !m.enabled) continue;
    if (isOpenLoan(r)) {
      const due = r.values.due as string | undefined;
      if (due && due < today) {
        out.push({ id: `loan-${r.id}`, kind: 'loan-overdue', severity: 'high', labId: r.labId, to: `m/loan`, title: `${itemName(r.values.item)} not returned`, detail: `${num(r.values.quantity) ?? 1} issued to ${r.values.borrower ?? 'someone'}, due ${fmtDate(due)} (${daysBetween(due, today)} days late)` });
      }
    }
    if (m.kind === 'incident' || m.kind === 'spill') {
      const status = String(r.values.status ?? '');
      const closed = m.closedValues?.includes(status);
      if (!closed) {
        const sev = String(r.values.severity ?? '');
        out.push({
          id: `acc-${r.id}`, kind: 'accident-open', labId: r.labId, to: `m/${m.id}`,
          severity: sev === 'Serious' || sev === 'Critical' || sev === 'Major' ? 'high' : 'medium',
          title: `${m.singular} still open: ${String(r.values.type ?? r.values.substance ?? itemName(r.values.item))}`,
          detail: `${fmtDate(String(r.values.when ?? '').slice(0, 10))}${sev ? ` · ${sev}` : ''}`,
        });
        const fu = r.values.followUp as string | undefined;
        if (fu && fu <= today) out.push({ id: `fu-${r.id}`, kind: 'followup-due', severity: 'high', labId: r.labId, to: `m/${m.id}`, title: `Follow-up due: ${String(r.values.type ?? r.values.substance ?? itemName(r.values.item))}`, detail: `${m.singular} · was due ${fmtDate(fu)}` });
      }
    }
    if (m.kind === 'requisition' && r.values.priority === 'Urgent' && !m.closedValues?.includes(String(r.values.status ?? ''))) {
      out.push({ id: `req-${r.id}`, kind: 'requirement-urgent', severity: 'medium', labId: r.labId, to: `m/requisition`, title: `Urgent: ${String(r.values.name ?? 'requirement')}`, detail: `Status: ${String(r.values.status ?? 'Requested')}` });
    }
  }

  out.push(...storageConflicts(s));

  const rank = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/** Items stored together whose storage groups must not share a shelf. */
export function storageConflicts(s: AppState): Alert[] {
  const out: Alert[] = [];
  const byPlace = new Map<string, Map<string, string[]>>();
  for (const i of s.items) {
    if (i.archived || i.quantity <= 0 || !i.storageGroup || !i.location) continue;
    const key = `${i.labId}\u0000${i.location}`;
    const groups = byPlace.get(key) ?? new Map<string, string[]>();
    groups.set(i.storageGroup, [...(groups.get(i.storageGroup) ?? []), i.name]);
    byPlace.set(key, groups);
  }
  for (const [key, groups] of byPlace) {
    const [labId, location] = key.split('\u0000');
    for (const [a, b] of s.settings.incompatible) {
      const ia = groups.get(a);
      const ib = groups.get(b);
      if (ia && ib) {
        out.push({
          id: `stg-${key}-${a}-${b}`, kind: 'storage-conflict', severity: 'high', labId, to: 'storage',
          title: `${a} and ${b} are stored together in ${location}`,
          detail: `${ia.slice(0, 3).join(', ')}${ia.length > 3 ? '…' : ''}  ·  ${ib.slice(0, 3).join(', ')}${ib.length > 3 ? '…' : ''}`,
        });
      }
    }
  }
  return out;
}
