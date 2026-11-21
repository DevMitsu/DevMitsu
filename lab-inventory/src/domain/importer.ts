import { parseDateLoose } from './dates';
import { num } from './fields';
import { categoriesForLab } from './inventory';
import type { NewItem } from '../store/actions';
import type { AppState, Category, FieldDef, Value } from './types';

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const SYNONYMS: Record<string, string[]> = {
  name: ['name', 'item', 'itemname', 'material', 'chemical', 'equipment', 'particulars'],
  code: ['code', 'itemcode', 'assettag', 'sku', 'tag'],
  category: ['category', 'itemcategory'],
  quantity: ['quantity', 'qty', 'stock', 'instock', 'count', 'currentstock'],
  unit: ['unit', 'uom'],
  location: ['location', 'place', 'shelf', 'cupboard', 'kept'],
  supplier: ['supplier', 'vendor'],
  unitCost: ['unitcost', 'cost', 'price', 'rate'],
  minStock: ['minstock', 'minimum', 'reorderlevel', 'minqty', 'min'],
  targetStock: ['targetstock', 'maxstock', 'par', 'fillupto', 'target'],
  status: ['status', 'condition'],
  expiry: ['expiry', 'expirydate', 'expires', 'expdate', 'expiryon'],
  lot: ['lot', 'batch', 'lotno', 'batchno', 'lotnumber', 'batchnumber'],
  hazards: ['hazards', 'hazard', 'hazardlabels', 'ghs'],
  storageGroup: ['storagegroup'],
  purchaseDate: ['purchasedate', 'dateofpurchase', 'purchased', 'boughton'],
  description: ['description', 'details'],
  notes: ['notes', 'remarks', 'comments'],
  tags: ['tags', 'keywords'],
};

export interface ImportResult {
  items: NewItem[];
  problems: string[];
  /** Columns the sheet has that match no field: they are ignored. */
  unknownHeaders: string[];
  skipped: number;
}

function coerce(f: FieldDef, raw: string, lists: AppState['lists']): Value {
  const t = raw.trim();
  if (!t) return undefined;
  switch (f.type) {
    case 'number':
    case 'money':
      return num(t);
    case 'date':
      return parseDateLoose(t) || undefined;
    case 'checkbox':
      return /^(y|yes|true|1|x|✓)$/i.test(t);
    case 'multiselect':
      return t.split(/[;,|]/).map((x) => x.trim()).filter(Boolean);
    case 'select': {
      const opts = f.listId ? (lists.find((l) => l.id === f.listId)?.options ?? []) : (f.options ?? []);
      return opts.find((o) => norm(o) === norm(t)) ?? t;
    }
    default:
      return t;
  }
}

export function mapTable(s: AppState, labId: string, table: string[][], defaultCategoryId: string): ImportResult {
  const result: ImportResult = { items: [], problems: [], unknownHeaders: [], skipped: 0 };
  if (table.length < 2) {
    result.problems.push('Paste or choose a table with a header row and at least one item.');
    return result;
  }
  const cats = categoriesForLab(s, labId);
  const header = table[0].map(norm);
  const lab = s.labs.find((l) => l.id === labId);

  const core: Record<string, number> = {};
  for (const [key, names] of Object.entries(SYNONYMS)) {
    const idx = header.findIndex((h) => names.includes(h));
    if (idx >= 0) core[key] = idx;
  }
  if (core.name === undefined) {
    result.problems.push('There is no "Name" column. The first row must hold column headings such as Name, Quantity, Unit, Location.');
    return result;
  }

  const customCols = new Map<number, FieldDef[]>(); // column -> fields (across categories) with that label
  const used = new Set(Object.values(core));
  header.forEach((h, idx) => {
    if (used.has(idx) || !h) return;
    const fs = cats.flatMap((c) => c.fields).filter((f) => norm(f.label) === h);
    if (fs.length) customCols.set(idx, fs);
    else result.unknownHeaders.push(table[0][idx]);
  });

  const statusList = s.lists.find((l) => l.id === 'itemStatus')?.options ?? [];
  const hazardList = s.lists.find((l) => l.id === 'hazards')?.options ?? [];
  const groupList = s.lists.find((l) => l.id === 'storageGroups')?.options ?? [];
  const unitList = s.lists.find((l) => l.id === 'units')?.options ?? [];
  const cell = (row: string[], key: string) => (core[key] === undefined ? '' : (row[core[key]] ?? '').trim());

  table.slice(1).forEach((row, n) => {
    const label = `Row ${n + 2}`;
    const name = cell(row, 'name');
    if (!name) {
      result.skipped++;
      return;
    }
    let cat: Category | undefined = cats.find((c) => c.id === defaultCategoryId) ?? cats[0];
    const catText = cell(row, 'category');
    if (catText) {
      const found = cats.find((c) => norm(c.name) === norm(catText) || norm(c.id) === norm(catText));
      if (found) cat = found;
      else result.problems.push(`${label} (${name}): category "${catText}" is not one of this lab's categories, so "${cat?.name}" was used.`);
    }
    if (!cat) {
      result.problems.push(`${label} (${name}): this lab has no categories to put it in.`);
      result.skipped++;
      return;
    }

    let quantity = 0;
    const qText = cell(row, 'quantity');
    if (qText) {
      const q = num(qText);
      if (q === undefined || q < 0) result.problems.push(`${label} (${name}): quantity "${qText}" is not a number, so 0 was used.`);
      else quantity = q;
    }
    const unitText = cell(row, 'unit');
    const unit = unitText ? (unitList.find((u) => norm(u) === norm(unitText)) ?? unitText) : cat.defaultUnit;
    const statusText = cell(row, 'status');
    const status = statusList.find((x) => norm(x) === norm(statusText)) ?? 'Good';
    if (statusText && !statusList.some((x) => norm(x) === norm(statusText))) {
      result.problems.push(`${label} (${name}): status "${statusText}" is not recognised, so "Good" was used.`);
    }
    const hazards = cell(row, 'hazards')
      .split(/[;,|]/)
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => hazardList.find((h) => norm(h) === norm(x)) ?? x);
    const groupText = cell(row, 'storageGroup');
    const dateOf = (key: string): string | undefined => {
      const t = cell(row, key);
      if (!t) return undefined;
      const p = parseDateLoose(t);
      if (!p) result.problems.push(`${label} (${name}): could not read the date "${t}".`);
      return p || undefined;
    };
    const money = (key: string) => {
      const t = cell(row, key).replace(/[^\d.,-]/g, '');
      return t ? num(t) : undefined;
    };

    const custom: Record<string, Value> = {};
    for (const [idx, fs] of customCols) {
      const f = fs.find((x) => cat!.fields.some((cf) => cf.id === x.id && cf.label === x.label));
      if (!f) continue;
      const v = coerce(f, row[idx] ?? '', s.lists);
      if (v !== undefined) custom[f.id] = v;
    }

    result.items.push({
      labId,
      categoryId: cat.id,
      name,
      code: cell(row, 'code') || undefined,
      description: cell(row, 'description') || undefined,
      quantity,
      unit,
      minStock: num(cell(row, 'minStock')),
      targetStock: num(cell(row, 'targetStock')),
      location: cell(row, 'location') || undefined,
      supplier: cell(row, 'supplier') || undefined,
      unitCost: money('unitCost'),
      purchaseDate: dateOf('purchaseDate'),
      status,
      lot: cell(row, 'lot') || undefined,
      expiry: dateOf('expiry'),
      hazards: hazards.length ? hazards : undefined,
      storageGroup: groupText ? (groupList.find((g) => norm(g) === norm(groupText)) ?? groupText) : undefined,
      custom,
      tags: cell(row, 'tags') ? cell(row, 'tags').split(/[;,|]/).map((x) => x.trim()).filter(Boolean) : undefined,
      notes: cell(row, 'notes') || undefined,
    });
  });

  if (!result.items.length && !result.problems.length) result.problems.push(`No items were found for ${lab?.name ?? 'this lab'}.`);
  return result;
}

/** A starter sheet for a category: headings (including its own fields) and one example row. */
export function templateRows(s: AppState, labId: string, cat: Category): string[][] {
  const lab = s.labs.find((l) => l.id === labId);
  const head = ['Name', 'Category', 'Quantity', 'Unit', 'Location', 'Min stock', 'Unit cost', 'Supplier', 'Status'];
  const ex = ['Example item', cat.name, '10', cat.defaultUnit, lab?.locations[0] ?? '', '5', '100', '', 'Good'];
  if (cat.trackExpiry) {
    head.push('Expiry', 'Lot');
    ex.push('2028-03-31', 'L-001');
  }
  if (cat.hazardous) {
    head.push('Hazards', 'Storage group');
    ex.push('Corrosive; Toxic', 'Acids');
  }
  for (const f of cat.fields) {
    head.push(f.label);
    ex.push('');
  }
  return [head, ex];
}
