import { daysBetween, fmtDate, fmtDateTime, todayStr } from '../../domain/dates';
import { num } from '../../domain/fields';
import { ALL, TXN_LABEL, expiryState, isLow, isOpenLoan, serviceState, stockValue } from '../../domain/inventory';
import type { AppState, Item, LabRecord, ModuleDef } from '../../domain/types';
import { recordDate, recordDay } from '../records/helpers';

export interface Table {
  title: string;
  columns: string[];
  rows: (string | number)[][];
  /** Right-aligned columns. */
  numeric?: number[];
  notes?: string[];
}

export interface Ctx {
  state: AppState;
  scope: string;
  from: string;
  to: string;
  groupBy?: string;
}

export interface ReportDef {
  id: string;
  title: string;
  description: string;
  timed?: boolean;
  groupOptions?: { id: string; label: string }[];
  build: (c: Ctx) => Table;
}

const labName = (s: AppState, id: string) => s.labs.find((l) => l.id === id)?.short ?? '';
const itemsIn = (c: Ctx) => c.state.items.filter((i) => !i.archived && (c.scope === ALL || i.labId === c.scope));
const catName = (s: AppState, i: Item) => s.categories.find((x) => x.id === i.categoryId)?.name ?? '';
const modOf = (s: AppState, kind: ModuleDef['kind']) => s.modules.find((m) => m.kind === kind);
const recsOf = (c: Ctx, kind: ModuleDef['kind']) => {
  const m = modOf(c.state, kind);
  if (!m) return { m, list: [] as LabRecord[] };
  const list = c.state.records
    .filter((r) => r.moduleId === m.id && (c.scope === ALL || r.labId === c.scope) && recordDay(m, r) >= c.from && recordDay(m, r) <= c.to)
    .sort((a, b) => recordDate(m, b).localeCompare(recordDate(m, a)));
  return { m, list };
};
const itemName = (s: AppState, id: unknown) => s.items.find((i) => i.id === id)?.name ?? '';
const unitOf = (s: AppState, id: unknown) => s.items.find((i) => i.id === id)?.unit ?? '';
const money = (s: AppState, n: number) => `${s.settings.currency}${Math.round(n).toLocaleString('en-IN')}`;

export const REPORTS: ReportDef[] = [
  {
    id: 'register', title: 'Hazardous chemical register', description: 'Every hazardous item with its hazards, storage group, location, quantity and expiry. The sheet safety inspectors ask for.',
    build: (c) => {
      const s = c.state;
      const rows = itemsIn(c).filter((i) => s.categories.find((x) => x.id === i.categoryId)?.hazardous)
        .sort((a, b) => (a.location ?? '').localeCompare(b.location ?? '') || a.name.localeCompare(b.name))
        .map((i) => [labName(s, i.labId), i.code, i.name, String(i.custom.cas ?? ''), (i.hazards ?? []).join(', '), i.storageGroup ?? '', i.location ?? '', `${i.quantity} ${i.unit}`, i.expiry ? fmtDate(i.expiry) : '', i.lot ?? '']);
      return { title: 'Hazardous chemical register', columns: ['Lab', 'Code', 'Substance', 'CAS no.', 'Hazards', 'Storage group', 'Location', 'Quantity', 'Expiry', 'Lot'], rows, notes: [`${rows.length} hazardous items`] };
    },
  },
  {
    id: 'stock', title: 'Stock summary & value', description: 'All items with quantity, unit cost and total value, with totals per category.',
    build: (c) => {
      const s = c.state;
      const list = itemsIn(c).sort((a, b) => catName(s, a).localeCompare(catName(s, b)) || a.name.localeCompare(b.name));
      const rows = list.map((i) => [labName(s, i.labId), catName(s, i), i.code, i.name, i.quantity, i.unit, i.unitCost ?? '', i.unitCost != null ? Math.round(stockValue(i)) : '']);
      const total = list.reduce((n, i) => n + stockValue(i), 0);
      const byCat = new Map<string, number>();
      list.forEach((i) => byCat.set(catName(s, i), (byCat.get(catName(s, i)) ?? 0) + stockValue(i)));
      return { title: 'Stock summary & value', columns: ['Lab', 'Category', 'Code', 'Item', 'Quantity', 'Unit', 'Unit cost', 'Value'], rows, numeric: [4, 6, 7],
        notes: [`${list.length} items · total value ${money(s, total)}`, ...[...byCat.entries()].filter(([, v]) => v > 0).map(([k, v]) => `${k}: ${money(s, v)}`)] };
    },
  },
  {
    id: 'reorder', title: 'Reorder list', description: 'Items at or below their reorder level, with a suggested order quantity and cost.',
    build: (c) => {
      const s = c.state;
      let total = 0;
      const rows = itemsIn(c).filter(isLow).sort((a, b) => (a.supplier ?? '~').localeCompare(b.supplier ?? '~') || a.name.localeCompare(b.name)).map((i) => {
        const target = i.targetStock ?? (i.minStock ?? 0) * 2;
        const order = Math.max(1, Math.round((target - i.quantity) * 1e6) / 1e6);
        const cost = i.unitCost != null ? order * i.unitCost : undefined;
        if (cost) total += cost;
        return [labName(s, i.labId), i.code, i.name, i.quantity, i.minStock ?? '', order, i.unit, i.supplier ?? '', cost != null ? Math.round(cost) : ''];
      });
      return { title: 'Reorder list', columns: ['Lab', 'Code', 'Item', 'In stock', 'Reorder level', 'Suggested order', 'Unit', 'Supplier', 'Est. cost'], rows, numeric: [3, 4, 5, 8], notes: [`${rows.length} items · estimated ${money(s, total)}`] };
    },
  },
  {
    id: 'expiry', title: 'Expiry report', description: 'Expired items and those expiring within the warning period set under Customise → Alerts & rules.',
    build: (c) => {
      const s = c.state;
      const today = todayStr();
      const rows = itemsIn(c).filter((i) => s.categories.find((x) => x.id === i.categoryId)?.trackExpiry && i.quantity > 0 && ['expired', 'soon'].includes(expiryState(i, s.settings.expiryWarnDays, today)))
        .sort((a, b) => a.expiry!.localeCompare(b.expiry!))
        .map((i) => [labName(s, i.labId), i.code, i.name, i.lot ?? '', fmtDate(i.expiry), daysBetween(today, i.expiry!) < 0 ? `expired ${-daysBetween(today, i.expiry!)} days ago` : `${daysBetween(today, i.expiry!)} days left`, `${i.quantity} ${i.unit}`, i.location ?? '']);
      return { title: 'Expiry report', columns: ['Lab', 'Code', 'Item', 'Lot', 'Expiry', 'Status', 'Quantity', 'Location'], rows, notes: [`Warning period: ${s.settings.expiryWarnDays} days`] };
    },
  },
  {
    id: 'usage', title: 'Usage summary', description: 'How much of each item was used in a period. Group it by item, class, practical or person.', timed: true,
    groupOptions: [{ id: 'item', label: 'By item' }, { id: 'class', label: 'By class' }, { id: 'practical', label: 'By practical' }, { id: 'user', label: 'By person' }],
    build: (c) => {
      const s = c.state;
      const { list } = recsOf(c, 'usage');
      const g = c.groupBy ?? 'item';
      const map = new Map<string, { qty: Map<string, number>; n: number; last: string }>();
      for (const r of list) {
        const key = g === 'item' ? itemName(s, r.values.item) : String(r.values[g] ?? '(not stated)');
        const e = map.get(key) ?? { qty: new Map(), n: 0, last: '' };
        const unit = unitOf(s, r.values.item);
        e.qty.set(unit, (e.qty.get(unit) ?? 0) + (num(r.values.quantity) ?? 0));
        e.n++;
        e.last = e.last > recordDay(undefined, r) ? e.last : String(r.values.date ?? '');
        map.set(key, e);
      }
      const label = { item: 'Item', class: 'Class', practical: 'Practical', user: 'Person' }[g] ?? 'Item';
      const rows = [...map.entries()].sort((a, b) => b[1].n - a[1].n).map(([k, e]) => [k, g === 'item' ? [...e.qty.entries()].map(([u, q]) => `${Math.round(q * 1000) / 1000} ${u}`).join(', ') : `${[...e.qty.values()].length} materials`, e.n, e.last ? fmtDate(e.last) : '']);
      return { title: `Usage ${label.toLowerCase() === 'item' ? 'by item' : `by ${label.toLowerCase()}`}`, columns: [label, g === 'item' ? 'Total used' : 'Materials', 'Entries', 'Last used'], rows, numeric: [2], notes: [`${list.length} usage entries from ${fmtDate(c.from)} to ${fmtDate(c.to === '9999' ? todayStr() : c.to)}`] };
    },
  },
  {
    id: 'incidents', title: 'Accident summary', description: 'Accidents in a period with a count by type and severity, and what was done about each.', timed: true,
    build: (c) => {
      const s = c.state;
      const { m, list } = recsOf(c, 'incident');
      const count = (key: string) => { const x = new Map<string, number>(); list.forEach((r) => x.set(String(r.values[key] ?? '—'), (x.get(String(r.values[key] ?? '—')) ?? 0) + 1)); return [...x.entries()].map(([k, v]) => `${k}: ${v}`).join(' · '); };
      const rows = list.map((r) => [labName(s, r.labId), fmtDateTime(String(r.values.when ?? '')), String(r.values.type ?? ''), String(r.values.severity ?? ''), String(r.values.involved ?? ''), String(r.values.description ?? ''), String(r.values.firstAid ?? ''), String(r.values.corrective ?? ''), String(r.values.status ?? '')]);
      void m;
      return { title: 'Accident summary', columns: ['Lab', 'When', 'Type', 'Severity', 'Involved', 'What happened', 'First aid', 'Corrective action', 'Status'], rows, notes: [`${list.length} accidents`, list.length ? `By severity: ${count('severity')}` : '', list.length ? `By type: ${count('type')}` : ''].filter(Boolean) };
    },
  },
  {
    id: 'losses', title: 'Spills, breakage & disposal', description: 'Everything lost, broken, spilled or thrown away in a period, with the cost where known.', timed: true,
    build: (c) => {
      const s = c.state;
      const rows: (string | number)[][] = [];
      let cost = 0;
      for (const kind of ['spill', 'breakage', 'disposal'] as const) {
        const { m, list } = recsOf(c, kind);
        for (const r of list) {
          const q = num(r.values.quantity);
          const it = s.items.find((i) => i.id === r.values.item);
          const est = num(r.values.cost) ?? (it?.unitCost != null && q ? it.unitCost * q : 0);
          cost += est;
          rows.push([recordDate(m, r).slice(0, 10), labName(s, r.labId), m?.singular ?? kind, it?.name ?? String(r.values.substance ?? ''), q ?? '', it?.unit ?? '', String(r.values.cause ?? r.values.reason ?? r.values.severity ?? ''), String(r.values.who ?? r.values.by ?? r.values.reporter ?? ''), est ? Math.round(est) : '']);
        }
      }
      rows.sort((a, b) => String(b[0]).localeCompare(String(a[0])));
      return { title: 'Spills, breakage & disposal', columns: ['Date', 'Lab', 'Type', 'Item', 'Quantity', 'Unit', 'Cause / reason', 'Who', 'Est. value'], rows: rows.map((r) => [fmtDate(String(r[0])), ...r.slice(1)]), numeric: [4, 8], notes: [`${rows.length} entries · estimated value ${money(s, cost)}`] };
    },
  },
  {
    id: 'fines', title: 'Fines', description: 'Fines charged for broken or lost equipment in a period: what is still to collect, what was paid, what was waived and why.', timed: true,
    build: (c) => {
      const s = c.state;
      const { list } = recsOf(c, 'breakage');
      const fined = list.filter((r) => (num(r.values.fine) ?? 0) > 0);
      const sum = (st: string) => fined.filter((r) => (r.values.fineStatus ?? 'Pending') === st).reduce((n, r) => n + (num(r.values.fine) ?? 0), 0);
      const rows = fined.map((r) => [labName(s, r.labId), fmtDate(String(r.values.date ?? '')), itemName(s, r.values.item), num(r.values.quantity) ?? '', String(r.values.who ?? ''), String(r.values.class ?? ''), num(r.values.fine) ?? '', String(r.values.fineStatus ?? 'Pending'), r.values.finePaidOn ? fmtDate(String(r.values.finePaidOn)) : '', String(r.values.fineNote ?? '')]);
      return { title: 'Fines', columns: ['Lab', 'Date', 'Item', 'Qty', 'Broken by', 'Class', 'Fine', 'Status', 'Paid on', 'Note'], rows, numeric: [3, 6],
        notes: [`${fined.length} fines · to collect ${money(s, sum('Pending'))} · collected ${money(s, sum('Paid'))} · waived ${money(s, sum('Waived'))}`] };
    },
  },
  {
    id: 'loans', title: 'Equipment loans', description: 'Equipment lent out in a period and whether it is back.', timed: true,
    build: (c) => {
      const s = c.state;
      const today = todayStr();
      const { list } = recsOf(c, 'loan');
      const rows = list.map((r) => {
        const open = isOpenLoan(r);
        const late = open && !!r.values.due && String(r.values.due) < today;
        return [labName(s, r.labId), fmtDate(String(r.values.issued ?? '')), itemName(s, r.values.item), num(r.values.quantity) ?? '', String(r.values.borrower ?? ''), String(r.values.group ?? ''), fmtDate(String(r.values.due ?? '')), r.values.returned ? fmtDate(String(r.values.returned)) : '', late ? 'OVERDUE' : open ? 'Out' : 'Returned'];
      });
      return { title: 'Equipment loans', columns: ['Lab', 'Issued', 'Equipment', 'Qty', 'Issued to', 'Class / group', 'Due', 'Returned', 'Status'], rows, numeric: [3], notes: [`${list.filter(isOpenLoan).length} still out`] };
    },
  },
  {
    id: 'requirements', title: 'Requirements & purchases', description: 'Everything requested in a period and where it stands, with estimated cost.', timed: true,
    build: (c) => {
      const s = c.state;
      const { list } = recsOf(c, 'requisition');
      const total = list.reduce((n, r) => n + (num(r.values.estCost) ?? 0), 0);
      const rows = list.map((r) => [labName(s, r.labId), fmtDate(String(r.values.requested ?? '')), String(r.values.name ?? ''), num(r.values.quantity) ?? '', String(r.values.unit ?? ''), String(r.values.priority ?? ''), String(r.values.by ?? ''), String(r.values.supplier ?? ''), num(r.values.estCost) ?? '', String(r.values.status ?? '')]);
      return { title: 'Requirements & purchases', columns: ['Lab', 'Requested', 'Item', 'Qty', 'Unit', 'Priority', 'By', 'Supplier', 'Est. cost', 'Status'], rows, numeric: [3, 8], notes: [`${list.length} requirements · estimated ${money(s, total)}`] };
    },
  },
  {
    id: 'service', title: 'Calibration & service schedule', description: 'Equipment that is serviced regularly, with when it was last done and when it is next due.',
    build: (c) => {
      const s = c.state;
      const today = todayStr();
      const rows = itemsIn(c).filter((i) => s.categories.find((x) => x.id === i.categoryId)?.trackService)
        .sort((a, b) => (a.nextServiceDue ?? '9999').localeCompare(b.nextServiceDue ?? '9999'))
        .map((i) => {
          const st = serviceState(i, s.settings.serviceWarnDays, today);
          return [labName(s, i.labId), i.code, i.name, i.lastServiced ? fmtDate(i.lastServiced) : '', i.nextServiceDue ? fmtDate(i.nextServiceDue) : '', i.serviceEveryDays ? `${i.serviceEveryDays} days` : '', st === 'overdue' ? 'OVERDUE' : st === 'soon' ? 'Due soon' : st === 'ok' ? 'OK' : 'No date set'];
        });
      return { title: 'Calibration & service schedule', columns: ['Lab', 'Code', 'Equipment', 'Last serviced', 'Next due', 'Interval', 'Status'], rows };
    },
  },
  {
    id: 'ledger', title: 'Stock ledger (audit trail)', description: 'Every stock movement in a period: receipts, usage, corrections, transfers.', timed: true,
    build: (c) => {
      const s = c.state;
      const rows = s.txns.filter((t) => (c.scope === ALL || t.labId === c.scope) && t.at.slice(0, 10) >= c.from && t.at.slice(0, 10) <= c.to).reverse()
        .map((t) => [fmtDateTime(t.at), labName(s, t.labId), s.items.find((i) => i.id === t.itemId)?.name ?? '(removed item)', TXN_LABEL[t.type], t.delta, t.balance, t.note ?? '', t.by ?? '']);
      return { title: 'Stock ledger', columns: ['When', 'Lab', 'Item', 'What', 'Change', 'Balance', 'Note', 'By'], rows, numeric: [4, 5], notes: [`${rows.length} movements`] };
    },
  },
];
