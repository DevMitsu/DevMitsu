import type { Draft } from 'immer';
import { addDays, stamp, todayStr } from '../domain/dates';
import { DEFAULT_LABS, emptyState } from '../domain/defaults';
import { defaultValues, num, validate } from '../domain/fields';
import { uid } from '../domain/ids';
import { ALL, nextCode, outOnLoan, stockEffect } from '../domain/inventory';
import { buildSample } from '../domain/sample';
import type {
  AppState,
  Category,
  Item,
  Lab,
  LabRecord,
  ListDef,
  ModuleDef,
  Person,
  Practical,
  Settings,
  StocktakeLine,
  Supplier,
  TxnType,
  Values,
} from '../domain/types';
import { getState, mutate, replaceState } from './store';

type D = Draft<AppState>;

const round = (n: number) => Math.round(n * 1e6) / 1e6;
const fail = (msg: string): never => {
  throw new Error(msg);
};

// ------------------------------------------------------------ internals

function itemIn(d: D, id: string) {
  return d.items.find((i) => i.id === id) ?? fail('That item no longer exists.');
}

function pushTxn(d: D, item: Draft<Item>, type: TxnType, delta: number, note?: string, recordId?: string) {
  const balance = round(item.quantity + delta);
  if (balance < 0 && !d.settings.allowNegativeStock) {
    fail(`Only ${item.quantity} ${item.unit} of ${item.name} in stock: cannot take out ${round(-delta)} ${item.unit}.`);
  }
  item.quantity = balance;
  item.updatedAt = stamp();
  d.txns.push({
    id: uid('t'),
    itemId: item.id,
    labId: item.labId,
    at: stamp(),
    type,
    delta: round(delta),
    balance,
    note: note || undefined,
    recordId,
    by: d.settings.currentUser || undefined,
  });
}

function ensureLocation(d: D, labId: string, location?: string) {
  const loc = location?.trim();
  if (!loc) return;
  const lab = d.labs.find((l) => l.id === labId);
  if (lab && !lab.locations.some((x) => x.toLowerCase() === loc.toLowerCase())) lab.locations.push(loc);
}

function checkCodeFree(d: D, code: string, exceptId?: string) {
  if (d.items.some((i) => i.id !== exceptId && i.code.toLowerCase() === code.toLowerCase())) {
    fail(`The code ${code} is already used by another item.`);
  }
}

function normaliseService(i: Draft<Item> | Item) {
  if (i.lastServiced && i.serviceEveryDays && !i.nextServiceDue) i.nextServiceDue = addDays(i.lastServiced, i.serviceEveryDays);
}

function labName(d: Pick<AppState, 'labs'>, id: string) {
  return d.labs.find((l) => l.id === id)?.name ?? '';
}

// ------------------------------------------------------------ items

export type NewItem = Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'code'> & { code?: string };

function addItemIn(d: D, input: NewItem): string {
  const name = input.name.trim();
  if (!name) fail('Give the item a name.');
  const code = input.code?.trim() || nextCode(d as AppState, input.labId, input.categoryId);
  checkCodeFree(d, code);
  const now = stamp();
  const item: Item = { ...input, name, code, custom: input.custom ?? {}, createdAt: now, updatedAt: now, id: uid('i') };
  const qty = Math.max(0, item.quantity || 0);
  item.quantity = 0;
  normaliseService(item);
  d.items.push(item);
  ensureLocation(d, item.labId, item.location);
  if (qty > 0) pushTxn(d, d.items[d.items.length - 1], 'opening', qty, 'Opening stock');
  return item.id;
}

export function addItem(input: NewItem): string {
  return mutate('Add item', (d) => addItemIn(d, input), { log: `Added ${input.name.trim()}`, labId: input.labId });
}

export function importItems(items: NewItem[]): number {
  return mutate(
    'Import items',
    (d) => {
      for (const i of items) addItemIn(d, i);
      return items.length;
    },
    { log: `Imported ${items.length} items`, labId: items[0]?.labId },
  );
}

export function updateItem(id: string, patch: Partial<Item>) {
  mutate(
    'Edit item',
    (d) => {
      const item = itemIn(d, id);
      const { quantity: _q, id: _i, createdAt: _c, ...rest } = patch;
      void _q; void _i; void _c;
      if (rest.name !== undefined && !rest.name.trim()) fail('Give the item a name.');
      if (rest.code !== undefined) {
        rest.code = rest.code.trim();
        if (!rest.code) fail('The item needs a code.');
        checkCodeFree(d, rest.code, id);
      }
      Object.assign(item, rest);
      item.updatedAt = stamp();
      normaliseService(item);
      ensureLocation(d, item.labId, item.location);
    },
    { log: `Edited ${getState().items.find((i) => i.id === id)?.name ?? 'item'}`, labId: getState().items.find((i) => i.id === id)?.labId },
  );
}

export function bulkUpdateItems(ids: string[], patch: Partial<Pick<Item, 'location' | 'status' | 'categoryId' | 'archived'>>) {
  mutate(
    'Bulk edit',
    (d) => {
      for (const id of ids) {
        const it = d.items.find((i) => i.id === id);
        if (!it) continue;
        Object.assign(it, patch);
        it.updatedAt = stamp();
        ensureLocation(d, it.labId, patch.location);
      }
    },
    { log: `Updated ${ids.length} items at once` },
  );
}

export function deleteItem(id: string) {
  const it = getState().items.find((i) => i.id === id);
  mutate(
    'Delete item',
    (d) => {
      d.items = d.items.filter((i) => i.id !== id);
      d.txns = d.txns.filter((t) => t.itemId !== id);
      d.practicals.forEach((p) => p.materials.forEach((m) => { if (m.itemId === id) m.itemId = undefined; }));
    },
    { log: `Deleted ${it?.name ?? 'an item'}`, labId: it?.labId },
  );
}

export function duplicateItem(id: string): string {
  return mutate('Duplicate item', (d) => {
    const src = itemIn(d, id);
    const copy: NewItem = {
      ...JSON.parse(JSON.stringify(src)),
      code: undefined,
      quantity: 0,
      lot: undefined,
      expiry: undefined,
      lastServiced: undefined,
      nextServiceDue: undefined,
    };
    return addItemIn(d, copy);
  });
}

// ------------------------------------------------------------ stock

export interface ReceiveInput {
  qty: number;
  note?: string;
  lot?: string;
  expiry?: string;
  unitCost?: number;
  supplier?: string;
}

function receiveIn(d: D, itemId: string, r: ReceiveInput, recordId?: string) {
  if (!(r.qty > 0)) fail('Enter how much was received.');
  const it = itemIn(d, itemId);
  pushTxn(d, it, 'receive', r.qty, r.note, recordId);
  if (r.lot) it.lot = r.lot;
  if (r.expiry) it.expiry = r.expiry;
  if (r.unitCost != null && r.unitCost >= 0) it.unitCost = r.unitCost;
  if (r.supplier) it.supplier = r.supplier;
}

export function receiveStock(itemId: string, r: ReceiveInput) {
  const it = getState().items.find((i) => i.id === itemId);
  mutate('Receive stock', (d) => receiveIn(d, itemId, r), { log: `Received ${r.qty} ${it?.unit ?? ''} of ${it?.name ?? 'item'}`, labId: it?.labId });
}

export function adjustStock(itemId: string, newQty: number, note: string) {
  const it = getState().items.find((i) => i.id === itemId);
  mutate(
    'Adjust stock',
    (d) => {
      if (!(newQty >= 0)) fail('The quantity cannot be negative.');
      const item = itemIn(d, itemId);
      const delta = round(newQty - item.quantity);
      if (delta === 0) fail('That is already the quantity in stock.');
      pushTxn(d, item, 'adjust', delta, note);
    },
    { log: `Set ${it?.name ?? 'item'} to ${newQty} ${it?.unit ?? ''}`, labId: it?.labId },
  );
}

/** Moves stock to another lab. Joins an identical item there, or creates it. Returns the destination item id. */
export function transferStock(itemId: string, toLabId: string, qty: number, note?: string): string {
  const src = getState().items.find((i) => i.id === itemId);
  return mutate(
    'Transfer stock',
    (d) => {
      const item = itemIn(d, itemId);
      if (toLabId === item.labId) fail('Choose a different lab.');
      if (!(qty > 0)) fail('Enter how much to transfer.');
      const free = round(item.quantity - (outOnLoan(d.records as LabRecord[]).get(item.id) ?? 0));
      if (qty > free) fail(`Only ${free} ${item.unit} can be moved (the rest is out on loan).`);
      const toName = labName(d, toLabId);
      let dest = d.items.find(
        (i) => i.labId === toLabId && !i.archived && i.name.toLowerCase() === item.name.toLowerCase() && i.unit === item.unit,
      );
      let destId: string;
      if (dest) destId = dest.id;
      else {
        const copy: NewItem = { ...JSON.parse(JSON.stringify(item)), labId: toLabId, code: undefined, quantity: 0, location: undefined };
        destId = addItemIn(d, copy);
        dest = d.items.find((i) => i.id === destId)!;
      }
      pushTxn(d, item, 'transfer-out', -qty, `To ${toName}${note ? `: ${note}` : ''}`);
      pushTxn(d, dest, 'transfer-in', qty, `From ${labName(d, item.labId)}${note ? `: ${note}` : ''}`);
      return destId;
    },
    { log: `Moved ${qty} ${src?.unit ?? ''} of ${src?.name ?? 'item'} to ${labName(getState(), toLabId)}`, labId: src?.labId },
  );
}

// ------------------------------------------------------------ records (usage, accidents, spills, loans ...)

function moduleIn(d: D, id: string) {
  return d.modules.find((m) => m.id === id) ?? fail('Unknown form.');
}

function cleanValues(m: Pick<ModuleDef, 'fields'>, v: Values): Values {
  const out: Values = {};
  for (const f of m.fields) {
    let x = v[f.id];
    if (x === '' || x === undefined || (Array.isArray(x) && x.length === 0)) continue;
    if (f.type === 'number' || f.type === 'money') x = num(x);
    if (typeof x === 'string') x = x.trim();
    if (x !== undefined && x !== null) out[f.id] = x;
  }
  return out;
}

function recordSummary(d: Pick<AppState, 'items'>, m: ModuleDef, v: Values): string {
  const it = d.items.find((i) => i.id === v.item);
  const bits = [it?.name, v.name, v.title, v.type, v.topic].filter(Boolean);
  return `${m.singular}${bits.length ? `: ${bits[0]}` : ''}`;
}

function syncService(d: D, itemId: string) {
  const item = d.items.find((i) => i.id === itemId);
  if (!item) return;
  const recs = d.records
    .filter((r) => r.moduleId === 'maintenance' && r.values.item === itemId && r.values.date)
    .sort((a, b) => String(b.values.date).localeCompare(String(a.values.date)));
  const last = recs[0];
  if (!last) return;
  item.lastServiced = String(last.values.date);
  item.nextServiceDue = (last.values.nextDue as string) || (item.serviceEveryDays ? addDays(String(last.values.date), item.serviceEveryDays) : undefined);
}

function saveRecordIn(d: D, moduleId: string, labId: string, rawValues: Values, id?: string): string {
  const m = moduleIn(d, moduleId) as ModuleDef;
  if (labId === ALL || !d.labs.some((l) => l.id === labId)) fail('Choose which lab this belongs to.');

  const errors = validate(m.fields, rawValues);
  const first = Object.keys(errors)[0];
  if (first) fail(`${m.fields.find((f) => f.id === first)?.label ?? first}: ${errors[first]}`);
  const values = cleanValues(m, rawValues);

  // Per-kind tidying and rules
  if (m.kind === 'requisition' && !values.name && values.item) values.name = itemIn(d, values.item as string).name;
  if (m.kind === 'requisition' && values.status === 'Received' && !values.receivedOn) values.receivedOn = todayStr();
  if (m.kind === 'loan') {
    const it = itemIn(d, values.item as string);
    const qty = num(values.quantity) ?? 0;
    if (!(qty > 0)) fail('Quantity: enter how many are being lent.');
    if (values.due && values.issued && String(values.due) < String(values.issued)) fail('Due back: cannot be before the issue date.');
    const out = outOnLoan(d.records as LabRecord[]);
    const mine = id ? d.records.find((r) => r.id === id) : undefined;
    const mineOut = mine && !mine.values.returned ? (num(mine.values.quantity) ?? 0) : 0;
    const free = round(it.quantity - (out.get(it.id) ?? 0) + mineOut);
    if (!values.returned && qty > free) fail(`Only ${free} ${it.unit} of ${it.name} available (the rest is already on loan or not in stock).`);
  }
  if (m.kind === 'maintenance' && !values.nextDue && values.item && values.date) {
    const it = itemIn(d, values.item as string);
    if (it.serviceEveryDays) values.nextDue = addDays(String(values.date), it.serviceEveryDays);
  }

  const now = stamp();
  let recId = id;
  const existing = id ? d.records.find((r) => r.id === id) : undefined;
  if (id && !existing) fail('That entry no longer exists.');

  if (existing) {
    const old = stockEffect(m, existing.values);
    if (old) pushTxn(d, itemIn(d, old.itemId), 'correction', old.qty, `Entry edited: ${m.singular}`, existing.id);
    existing.values = values;
    existing.labId = labId;
    existing.updatedAt = now;
  } else {
    recId = uid('r');
    d.records.push({ id: recId, moduleId, labId, values, createdAt: now, updatedAt: now, by: d.settings.currentUser || undefined });
  }

  const eff = stockEffect(m, values);
  if (eff) {
    const it = itemIn(d, eff.itemId);
    pushTxn(d, it, eff.type, -eff.qty, m.singular + (values.practical ? `: ${values.practical}` : ''), recId);
  }
  if (m.kind === 'maintenance' && values.item) syncService(d, values.item as string);
  return recId!;
}

export function saveRecord(moduleId: string, labId: string, values: Values, id?: string): string {
  const s = getState();
  const m = s.modules.find((x) => x.id === moduleId);
  return mutate(
    id ? 'Edit entry' : 'Add entry',
    (d) => saveRecordIn(d, moduleId, labId, values, id),
    { log: `${id ? 'Updated' : 'Logged'} ${m ? recordSummary(s, m, values).toLowerCase() : 'entry'}`, labId },
  );
}

export function deleteRecord(id: string) {
  const s = getState();
  const r = s.records.find((x) => x.id === id);
  const m = r && s.modules.find((x) => x.id === r.moduleId);
  mutate(
    'Delete entry',
    (d) => {
      const rec = d.records.find((x) => x.id === id);
      if (!rec) return;
      const mod = moduleIn(d, rec.moduleId) as ModuleDef;
      const eff = stockEffect(mod, rec.values);
      if (eff && d.items.some((i) => i.id === eff.itemId)) pushTxn(d, itemIn(d, eff.itemId), 'correction', eff.qty, `Entry deleted: ${mod.singular}`, rec.id);
      d.records = d.records.filter((x) => x.id !== id);
      if (mod.kind === 'maintenance' && rec.values.item) syncService(d, rec.values.item as string);
    },
    { log: r && m ? `Deleted ${recordSummary(s, m, r.values).toLowerCase()}` : undefined, labId: r?.labId },
  );
}

export function setRecordStatus(id: string, status: string) {
  mutate('Change status', (d) => {
    const r = d.records.find((x) => x.id === id) ?? fail('That entry no longer exists.');
    const m = moduleIn(d, r.moduleId) as ModuleDef;
    if (!m.statusFieldId) return;
    r.values[m.statusFieldId] = status;
    if (m.kind === 'requisition' && status === 'Received' && !r.values.receivedOn) r.values.receivedOn = todayStr();
    r.updatedAt = stamp();
  });
}

export function returnLoan(id: string, date: string, condition?: string, note?: string) {
  mutate(
    'Return equipment',
    (d) => {
      const r = d.records.find((x) => x.id === id) ?? fail('That loan no longer exists.');
      if (r.values.returned) fail('Already returned.');
      if (r.values.issued && date < String(r.values.issued)) fail('The return date cannot be before the issue date.');
      r.values.returned = date;
      if (condition) r.values.condition = condition;
      if (note) r.values.notes = [r.values.notes, note].filter(Boolean).join(' | ');
      r.updatedAt = stamp();
    },
    { log: 'Equipment returned', labId: getState().records.find((r) => r.id === id)?.labId },
  );
}

/** Marks a requirement received and, if it is linked to an item, adds the stock. */
export function receiveRequirement(id: string, qty: number, date: string, addToStock: boolean, extra: Partial<ReceiveInput> = {}) {
  mutate(
    'Receive requirement',
    (d) => {
      const r = d.records.find((x) => x.id === id) ?? fail('That requirement no longer exists.');
      const m = moduleIn(d, r.moduleId) as ModuleDef;
      if (m.kind !== 'requisition') fail('Not a requirement.');
      const itemId = r.values.item as string | undefined;
      if (addToStock) {
        if (!itemId || !d.items.some((i) => i.id === itemId)) fail('Link this requirement to an inventory item to add the stock.');
        receiveIn(d, itemId!, { qty, note: `Order received${r.values.po ? ` (${r.values.po})` : ''}`, supplier: r.values.supplier as string, ...extra }, r.id);
      }
      r.values.status = 'Received';
      r.values.receivedOn = date;
      r.updatedAt = stamp();
    },
    { log: `Received: ${String(getState().records.find((r) => r.id === id)?.values.name ?? 'requirement')}`, labId: getState().records.find((r) => r.id === id)?.labId },
  );
}

/** Creates "Requested" requirements for items that have fallen to their reorder level. Returns how many were created. */
export function requestRestock(itemIds: string[]): number {
  return mutate(
    'Request restock',
    (d) => {
      const mod = d.modules.find((m) => m.kind === 'requisition');
      if (!mod) fail('The Requirements form is switched off.');
      let n = 0;
      for (const id of itemIds) {
        const it = d.items.find((i) => i.id === id);
        if (!it) continue;
        const open = d.records.some(
          (r) => r.moduleId === mod!.id && r.values.item === id && !mod!.closedValues?.includes(String(r.values.status ?? '')),
        );
        if (open) continue;
        const target = it.targetStock ?? (it.minStock ?? 0) * 2;
        const qty = Math.max(1, round(target - it.quantity));
        saveRecordIn(
          d,
          mod!.id,
          it.labId,
          { ...defaultValues(mod!.fields), item: it.id, name: it.name, quantity: qty, unit: it.unit, reason: 'Below reorder level', supplier: it.supplier, status: 'Requested' },
        );
        n++;
      }
      return n;
    },
    { log: 'Requested restock for low items' },
  );
}

// ------------------------------------------------------------ practicals

export function savePractical(p: Omit<Practical, 'id' | 'createdAt'> & { id?: string }): string {
  return mutate(
    'Save practical',
    (d) => {
      if (!p.name.trim()) fail('Give the practical a name.');
      if (p.id) {
        const ex = d.practicals.find((x) => x.id === p.id) ?? fail('That practical no longer exists.');
        Object.assign(ex, p);
        return ex.id;
      }
      const id = uid('p');
      d.practicals.push({ ...p, id, createdAt: stamp() });
      return id;
    },
    { log: `Saved practical ${p.name}`, labId: p.labId },
  );
}

export function deletePractical(id: string) {
  mutate('Delete practical', (d) => {
    d.practicals = d.practicals.filter((p) => p.id !== id);
  });
}

/** Records the usage of every linked material of a practical for N groups, all at once or not at all. */
export function runPractical(practicalId: string, groups: number, info: { date: string; class?: string; user?: string; notes?: string }): number {
  const p = getState().practicals.find((x) => x.id === practicalId);
  return mutate(
    'Run practical',
    (d) => {
      const prac = d.practicals.find((x) => x.id === practicalId) ?? fail('That practical no longer exists.');
      const mod = d.modules.find((m) => m.kind === 'usage' && m.enabled) ?? fail('The Usage log is switched off.');
      let n = 0;
      for (const mat of prac.materials) {
        if (!mat.itemId || !(mat.qtyPerGroup > 0)) continue;
        saveRecordIn(d, mod.id, prac.labId, {
          date: info.date,
          item: mat.itemId,
          quantity: round(mat.qtyPerGroup * groups),
          practical: prac.name,
          purpose: 'Class practical',
          class: info.class,
          students: groups,
          user: info.user,
          notes: info.notes,
        });
        n++;
      }
      return n;
    },
    { log: `Ran practical ${p?.name ?? ''} for ${groups} groups`, labId: p?.labId },
  );
}

// ------------------------------------------------------------ stocktake

export function finishStocktake(labId: string, scope: string, lines: StocktakeLine[], notes?: string): number {
  return mutate(
    'Stocktake',
    (d) => {
      let changed = 0;
      const done: StocktakeLine[] = [];
      for (const l of lines) {
        const it = d.items.find((i) => i.id === l.itemId);
        if (!it) continue;
        done.push({ itemId: it.id, expected: it.quantity, counted: l.counted });
        const delta = round(l.counted - it.quantity);
        if (delta !== 0) {
          pushTxn(d, it, 'stocktake', delta, `Stocktake: ${scope}`);
          changed++;
        }
      }
      d.stocktakes.unshift({ id: uid('st'), labId, at: stamp(), by: d.settings.currentUser || undefined, scope, lines: done, notes });
      return changed;
    },
    { log: `Stocktake of ${scope}: ${lines.length} items counted`, labId },
  );
}

// ------------------------------------------------------------ people, suppliers

export function savePerson(p: Omit<Person, 'id'> & { id?: string }) {
  mutate('Save person', (d) => {
    if (!p.name.trim()) fail('Enter a name.');
    if (p.id) {
      const ex = d.people.find((x) => x.id === p.id);
      if (ex) Object.assign(ex, p);
    } else d.people.push({ ...p, id: uid('pe') });
  });
}
export function deletePerson(id: string) {
  mutate('Delete person', (d) => {
    d.people = d.people.filter((p) => p.id !== id);
  });
}
export function saveSupplier(s: Omit<Supplier, 'id'> & { id?: string }) {
  mutate('Save supplier', (d) => {
    if (!s.name.trim()) fail('Enter a name.');
    if (s.id) {
      const ex = d.suppliers.find((x) => x.id === s.id);
      if (ex) Object.assign(ex, s);
    } else d.suppliers.push({ ...s, id: uid('su') });
  });
}
export function deleteSupplier(id: string) {
  mutate('Delete supplier', (d) => {
    d.suppliers = d.suppliers.filter((s) => s.id !== id);
  });
}

// ------------------------------------------------------------ customisation

export function updateSettings(patch: Partial<Settings>) {
  mutate('Change settings', (d) => {
    Object.assign(d.settings, patch);
  }, { noUndo: true });
}

/** Add or edit a lab. `copyFrom`: new lab also gets the categories and forms the other lab uses. */
export function saveLab(lab: Omit<Lab, 'id' | 'locations'> & { id?: string; locations?: string[] }, copyFrom?: string): string {
  return mutate(
    'Save lab',
    (d) => {
      if (!lab.name.trim()) fail('Give the lab a name.');
      if (!lab.short.trim()) fail('Give the lab a short code, e.g. PHY.');
      const short = lab.short.trim().toUpperCase();
      if (d.labs.some((l) => l.id !== lab.id && l.short === short)) fail(`The code ${short} is used by another lab.`);
      if (lab.id) {
        const ex = d.labs.find((l) => l.id === lab.id) ?? fail('That lab no longer exists.');
        Object.assign(ex, { ...lab, short });
        return ex.id;
      }
      const base = lab.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'lab';
      let id = base;
      for (let n = 2; d.labs.some((l) => l.id === id); n++) id = `${base}-${n}`;
      d.labs.push({ ...lab, id, short, locations: lab.locations ?? [] });
      if (copyFrom) {
        d.categories.forEach((c) => { if (c.labIds.includes(copyFrom)) c.labIds.push(id); });
        d.modules.forEach((m) => { if (m.labIds.length && m.labIds.includes(copyFrom)) m.labIds.push(id); });
        const src = d.labs.find((l) => l.id === copyFrom);
        if (src) d.labs[d.labs.length - 1].locations = [...src.locations];
      }
      return id;
    },
    { log: `Saved lab ${lab.name}` },
  );
}

export function deleteLab(id: string) {
  mutate('Delete lab', (d) => {
    if (d.items.some((i) => i.labId === id) || d.records.some((r) => r.labId === id)) {
      fail('This lab has items or records. Archive it instead, so nothing is lost.');
    }
    d.labs = d.labs.filter((l) => l.id !== id);
    d.categories.forEach((c) => { c.labIds = c.labIds.filter((x) => x !== id); });
    d.modules.forEach((m) => { m.labIds = m.labIds.filter((x) => x !== id); });
  });
}

export function setLabLocations(labId: string, locations: string[], renames: Record<string, string> = {}) {
  mutate('Change locations', (d) => {
    const lab = d.labs.find((l) => l.id === labId) ?? fail('That lab no longer exists.');
    lab.locations = locations;
    for (const it of d.items) {
      if (it.labId === labId && it.location && renames[it.location]) it.location = renames[it.location];
    }
  });
}

export function saveCategory(c: Omit<Category, 'id'> & { id?: string }): string {
  return mutate('Save category', (d) => {
    if (!c.name.trim()) fail('Give the category a name.');
    const ids = new Set<string>();
    for (const f of c.fields) {
      if (!f.label.trim()) fail('Every field needs a label.');
      if (ids.has(f.id)) fail(`Two fields share the key ${f.id}.`);
      ids.add(f.id);
    }
    if (c.id) {
      const ex = d.categories.find((x) => x.id === c.id) ?? fail('That category no longer exists.');
      Object.assign(ex, c);
      return ex.id;
    }
    let id = c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cat';
    for (let n = 2; d.categories.some((x) => x.id === id); n++) id = `${id.replace(/-\d+$/, '')}-${n}`;
    d.categories.push({ ...c, id });
    return id;
  });
}

export function deleteCategory(id: string) {
  mutate('Delete category', (d) => {
    const used = d.items.filter((i) => i.categoryId === id).length;
    if (used) fail(`${used} items use this category. Move them to another category first, or archive the category.`);
    d.categories = d.categories.filter((c) => c.id !== id);
  });
}

export function saveList(l: Omit<ListDef, 'id'> & { id?: string }): string {
  return mutate('Save list', (d) => {
    if (!l.name.trim()) fail('Give the list a name.');
    const options = [...new Set(l.options.map((o) => o.trim()).filter(Boolean))];
    if (l.id) {
      const ex = d.lists.find((x) => x.id === l.id) ?? fail('That list no longer exists.');
      Object.assign(ex, { ...l, options });
      return ex.id;
    }
    let id = 'l-' + (l.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'list');
    for (let n = 2; d.lists.some((x) => x.id === id); n++) id = `${id.replace(/-\d+$/, '')}-${n}`;
    d.lists.push({ ...l, id, options });
    return id;
  });
}

export function deleteList(id: string) {
  mutate('Delete list', (d) => {
    const l = d.lists.find((x) => x.id === id);
    if (l?.builtin) fail('Built-in lists cannot be deleted, but you can edit their options.');
    const uses = [
      ...d.modules.flatMap((m) => m.fields.filter((f) => f.listId === id).map((f) => `${m.name} → ${f.label}`)),
      ...d.categories.flatMap((c) => c.fields.filter((f) => f.listId === id).map((f) => `${c.name} → ${f.label}`)),
    ];
    if (uses.length) fail(`This list is used by: ${uses.slice(0, 4).join(', ')}. Change those fields first.`);
    d.lists = d.lists.filter((x) => x.id !== id);
  });
}

export function saveModule(m: Omit<ModuleDef, 'id' | 'order'> & { id?: string; order?: number }): string {
  return mutate('Save form', (d) => {
    if (!m.name.trim()) fail('Give the log a name.');
    const ids = new Set<string>();
    for (const f of m.fields) {
      if (!f.label.trim()) fail('Every field needs a label.');
      if (ids.has(f.id)) fail(`Two fields share the key ${f.id}.`);
      ids.add(f.id);
    }
    if (m.dateFieldId && !ids.has(m.dateFieldId)) fail('Choose which field holds the date of each entry.');
    if (m.id) {
      const ex = d.modules.find((x) => x.id === m.id) ?? fail('That form no longer exists.');
      Object.assign(ex, m);
      return ex.id;
    }
    let id = 'x-' + (m.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'log');
    for (let n = 2; d.modules.some((x) => x.id === id); n++) id = `${id.replace(/-\d+$/, '')}-${n}`;
    d.modules.push({ ...m, id, order: m.order ?? Math.max(0, ...d.modules.map((x) => x.order)) + 1 });
    return id;
  });
}

export function deleteModule(id: string) {
  mutate('Delete log', (d) => {
    const m = d.modules.find((x) => x.id === id);
    if (m?.builtin) fail('Built-in logs cannot be deleted. Switch them off instead.');
    d.modules = d.modules.filter((x) => x.id !== id);
    d.records = d.records.filter((r) => r.moduleId !== id);
  });
}

export function moveModule(id: string, dir: -1 | 1) {
  mutate('Reorder logs', (d) => {
    const sorted = [...d.modules].sort((a, b) => a.order - b.order);
    const i = sorted.findIndex((m) => m.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= sorted.length) return;
    const a = d.modules.find((m) => m.id === sorted[i].id)!;
    const b = d.modules.find((m) => m.id === sorted[j].id)!;
    [a.order, b.order] = [b.order, a.order];
  }, { noUndo: true });
}

// ------------------------------------------------------------ data

export function markBackup() {
  mutate('Backup', (d) => {
    d.settings.lastBackupAt = stamp();
  }, { noUndo: true });
}

export interface SetupInput {
  schoolName: string;
  labIds: string[];
  extraLabs: string[];
  sample: boolean;
}

export function completeSetup(input: SetupInput) {
  const fresh = emptyState();
  const mine = getState().settings;
  Object.assign(fresh.settings, { theme: mine.theme, textSize: mine.textSize, compact: mine.compact, currentUser: mine.currentUser, lastBackupAt: mine.lastBackupAt, itemColumns: mine.itemColumns });
  fresh.settings.schoolName = input.schoolName.trim() || 'Our School';
  const keep = DEFAULT_LABS.filter((l) => input.labIds.includes(l.id));
  fresh.labs = keep.map((l) => structuredClone(l));
  const palette = ['#d97706', '#0891b2', '#db2777', '#4f46e5', '#65a30d'];
  input.extraLabs.forEach((name, n) => {
    const nm = name.trim();
    if (!nm) return;
    const id = nm.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `lab-${n}`;
    fresh.labs.push({
      id, name: nm, short: nm.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'LAB', color: palette[n % palette.length],
      icon: 'beaker', locations: ['Cupboard 1', 'Cupboard 2', 'Store room'],
    });
    // A new lab can use the glassware category as well as every general-purpose one
    fresh.categories.forEach((c) => { if (c.id === 'glassware') c.labIds.push(id); });
  });
  fresh.setupDone = true;
  const state = input.sample ? buildSample(fresh) : fresh;
  replaceState(state);
}

export function loadSample() {
  replaceState(buildSample({ ...emptyStateKeepingSetup(getState()) }));
}

function emptyStateKeepingSetup(s: AppState): AppState {
  const e = emptyState();
  return { ...e, setupDone: true, settings: s.settings, labs: s.labs, categories: s.categories, lists: s.lists, modules: s.modules };
}

/** Removes every item, log and practical but keeps all customisation (labs, categories, forms, lists). */
export function clearData() {
  mutate('Clear data', (d) => {
    d.items = [];
    d.txns = [];
    d.records = [];
    d.practicals = [];
    d.stocktakes = [];
    d.people = [];
    d.suppliers = [];
    d.activity = [];
    d.sample = false;
  }, { noUndo: true });
}

/** Wipes everything, including customisation, and returns to the first-run setup. */
export function resetEverything() {
  replaceState(emptyState());
}
