import { beforeEach, describe, expect, it } from 'vitest';
import { computeAlerts } from './alerts';
import { parseTable, toCSV } from './csv';
import { addDays, daysBetween, parseDateLoose, todayStr } from './dates';
import { emptyState, migrate } from './defaults';
import { mapTable } from './importer';
import { nextCode } from './inventory';
import { buildSample } from './sample';
import * as A from '../store/actions';
import { getState, replaceState, undo } from '../store/store';
import type { AppState } from './types';

function fresh(sample = false): AppState {
  const e = emptyState();
  e.setupDone = true;
  replaceState(sample ? buildSample(e) : e);
  return getState();
}

const item = (name: string) => getState().items.find((i) => i.name === name)!;

describe('dates', () => {
  it('adds days and counts the difference', () => {
    expect(addDays('2026-02-27', 3)).toBe('2026-03-02');
    expect(daysBetween('2026-01-01', '2026-12-31')).toBe(364);
    expect(daysBetween('2026-03-10', '2026-03-01')).toBe(-9);
  });
  it('reads dates the way people type them', () => {
    expect(parseDateLoose('21/11/2026')).toBe('2026-11-21');
    expect(parseDateLoose('5-3-26')).toBe('2026-03-05');
    expect(parseDateLoose('21 Nov 2026')).toBe('2026-11-21');
    expect(parseDateLoose('2026-11-21')).toBe('2026-11-21');
    expect(parseDateLoose('31/02/2026')).toBe('');
    expect(parseDateLoose('soon')).toBe('');
  });
});

describe('csv', () => {
  it('parses quoted commas, quotes and newlines', () => {
    expect(parseTable('a,b\n"x, y","say ""hi"""\n"two\nlines",z')).toEqual([['a', 'b'], ['x, y', 'say "hi"'], ['two\nlines', 'z']]);
  });
  it('detects tab-separated paste from Excel', () => {
    expect(parseTable('Name\tQty\nBeaker\t5')).toEqual([['Name', 'Qty'], ['Beaker', '5']]);
  });
  it('neutralises spreadsheet formulas on export', () => {
    expect(toCSV(['a'], [['=1+1'], ['-5'], ['ok']])).toBe("a\r\n'=1+1\r\n-5\r\nok");
  });
});

describe('sample data', () => {
  it('has a consistent stock ledger for every item', () => {
    const s = fresh(true);
    expect(s.items.length).toBeGreaterThan(30);
    for (const i of s.items) {
      const t = s.txns.filter((x) => x.itemId === i.id);
      if (!t.length) continue;
      expect(t[t.length - 1].balance).toBeCloseTo(i.quantity, 5);
      expect(Math.min(...t.map((x) => x.balance))).toBeGreaterThanOrEqual(0);
    }
  });
  it('produces unique item codes', () => {
    const s = fresh(true);
    expect(new Set(s.items.map((i) => i.code)).size).toBe(s.items.length);
  });
  it('raises the alerts the demo is meant to show', () => {
    const s = fresh(true);
    const kinds = new Set(computeAlerts(s).map((a) => a.kind));
    for (const k of ['low-stock', 'expired', 'expiring', 'loan-overdue', 'service-overdue', 'storage-conflict', 'accident-open']) {
      expect(kinds.has(k as never)).toBe(true);
    }
  });
});

describe('item codes', () => {
  it('numbers per lab and category, filling on from the highest', () => {
    fresh();
    expect(nextCode(getState(), 'chemistry', 'reagents')).toBe('CHE-RGT-0001');
    A.addItem({ labId: 'chemistry', categoryId: 'reagents', name: 'A', quantity: 0, unit: 'g', status: 'Good', custom: {} });
    A.addItem({ labId: 'chemistry', categoryId: 'reagents', name: 'B', quantity: 0, unit: 'g', status: 'Good', custom: {} });
    expect(getState().items.map((i) => i.code)).toEqual(['CHE-RGT-0001', 'CHE-RGT-0002']);
    expect(nextCode(getState(), 'physics', 'instruments')).toBe('PHY-EQP-0001');
  });
  it('refuses a duplicate code', () => {
    fresh();
    A.addItem({ labId: 'physics', categoryId: 'instruments', name: 'A', code: 'X1', quantity: 0, unit: 'pcs', status: 'Good', custom: {} });
    expect(() => A.addItem({ labId: 'physics', categoryId: 'instruments', name: 'B', code: 'x1', quantity: 0, unit: 'pcs', status: 'Good', custom: {} })).toThrow(/already used/);
  });
});

describe('stock rules', () => {
  beforeEach(() => {
    fresh();
    A.addItem({ labId: 'chemistry', categoryId: 'reagents', name: 'NaOH', quantity: 100, unit: 'g', status: 'Good', custom: {} });
  });
  const use = (qty: number, id?: string) => A.saveRecord('usage', 'chemistry', { date: todayStr(), item: item('NaOH').id, quantity: qty }, id);

  it('opening stock creates a ledger line', () => {
    expect(getState().txns).toHaveLength(1);
    expect(getState().txns[0]).toMatchObject({ type: 'opening', delta: 100, balance: 100 });
  });
  it('usage takes stock off', () => {
    use(30);
    expect(item('NaOH').quantity).toBe(70);
  });
  it('refuses to use more than is in stock, and changes nothing', () => {
    const before = getState();
    expect(() => use(101)).toThrow(/Only 100 g/);
    expect(getState()).toBe(before);
  });
  it('editing an entry reverses the old effect and applies the new one', () => {
    const id = use(30);
    use(10, id);
    expect(item('NaOH').quantity).toBe(90);
    expect(getState().records).toHaveLength(1);
  });
  it('deleting an entry puts the stock back', () => {
    const id = use(30);
    A.deleteRecord(id);
    expect(item('NaOH').quantity).toBe(100);
  });
  it('a spill only deducts when asked to', () => {
    const id = item('NaOH').id;
    A.saveRecord('spill', 'chemistry', { when: '2026-01-01T10:00', item: id, quantity: 10, deduct: true, severity: 'Minor' });
    A.saveRecord('spill', 'chemistry', { when: '2026-01-01T10:00', item: id, quantity: 10, deduct: false, severity: 'Minor' });
    expect(item('NaOH').quantity).toBe(90);
  });
  it('breakage and disposal take stock off', () => {
    const id = item('NaOH').id;
    A.saveRecord('breakage', 'chemistry', { date: todayStr(), item: id, quantity: 5 });
    A.saveRecord('disposal', 'chemistry', { date: todayStr(), item: id, quantity: 20 });
    expect(item('NaOH').quantity).toBe(75);
  });
  it('receiving adds stock and can update expiry', () => {
    A.receiveStock(item('NaOH').id, { qty: 50, expiry: '2030-01-01', lot: 'L9' });
    expect(item('NaOH')).toMatchObject({ quantity: 150, expiry: '2030-01-01', lot: 'L9' });
  });
  it('adjusting sets the quantity and records the difference', () => {
    A.adjustStock(item('NaOH').id, 80, 'Counted');
    expect(item('NaOH').quantity).toBe(80);
    expect(getState().txns.at(-1)).toMatchObject({ type: 'adjust', delta: -20, balance: 80 });
  });
  it('rounds away floating point noise', () => {
    use(0.1);
    use(0.2);
    expect(item('NaOH').quantity).toBe(99.7);
  });
  it('undo restores the previous state', () => {
    use(30);
    undo();
    expect(item('NaOH').quantity).toBe(100);
  });
  it('requires the fields marked required', () => {
    expect(() => A.saveRecord('usage', 'chemistry', { date: todayStr(), quantity: 5 })).toThrow(/Item used: Required/);
    expect(() => A.saveRecord('usage', 'chemistry', { date: todayStr(), item: item('NaOH').id, quantity: -2 })).toThrow(/negative/);
  });
});

describe('loans', () => {
  beforeEach(() => {
    fresh();
    A.addItem({ labId: 'physics', categoryId: 'instruments', name: 'Stopwatch', quantity: 10, unit: 'pcs', status: 'Good', custom: {} });
  });
  const lend = (qty: number) =>
    A.saveRecord('loan', 'physics', { issued: todayStr(), item: item('Stopwatch').id, quantity: qty, borrower: 'Mr. X', due: addDays(todayStr(), 3) });
  it('cannot lend more than is available', () => {
    lend(6);
    expect(() => lend(5)).toThrow(/Only 4 pcs/);
    lend(4);
  });
  it('lending does not change the stock, returning frees availability', () => {
    const id = lend(6);
    expect(item('Stopwatch').quantity).toBe(10);
    A.returnLoan(id, todayStr(), 'Good');
    lend(10);
  });
  it('cannot return twice', () => {
    const id = lend(1);
    A.returnLoan(id, todayStr());
    expect(() => A.returnLoan(id, todayStr())).toThrow(/Already returned/);
  });
  it('flags overdue loans', () => {
    A.saveRecord('loan', 'physics', { issued: addDays(todayStr(), -10), item: item('Stopwatch').id, quantity: 1, borrower: 'Mr. X', due: addDays(todayStr(), -3) });
    expect(computeAlerts(getState()).some((a) => a.kind === 'loan-overdue')).toBe(true);
  });
});

describe('requirements', () => {
  it('receiving a linked requirement adds stock and closes it', () => {
    fresh();
    A.addItem({ labId: 'chemistry', categoryId: 'glassware', name: 'Burette', quantity: 2, unit: 'pcs', status: 'Good', custom: {} });
    const id = A.saveRecord('requisition', 'chemistry', { requested: todayStr(), item: item('Burette').id, name: 'Burette', quantity: 6, status: 'Ordered' });
    A.receiveRequirement(id, 6, todayStr(), true);
    expect(item('Burette').quantity).toBe(8);
    expect(getState().records[0].values.status).toBe('Received');
  });
  it('restock requests are made once, for items at or below their reorder level', () => {
    fresh();
    A.addItem({ labId: 'chemistry', categoryId: 'reagents', name: 'HCl', quantity: 100, unit: 'mL', minStock: 500, targetStock: 2000, status: 'Good', custom: {} });
    expect(A.requestRestock([item('HCl').id])).toBe(1);
    expect(getState().records[0].values.quantity).toBe(1900);
    expect(A.requestRestock([item('HCl').id])).toBe(0);
  });
});

describe('maintenance', () => {
  it('updates the equipment’s next due date and uses its service interval when none is given', () => {
    fresh();
    A.addItem({ labId: 'physics', categoryId: 'instruments', name: 'Meter', quantity: 1, unit: 'pcs', status: 'Good', serviceEveryDays: 90, custom: {} });
    A.saveRecord('maintenance', 'physics', { date: '2026-01-10', item: item('Meter').id, type: 'Calibration' });
    expect(item('Meter')).toMatchObject({ lastServiced: '2026-01-10', nextServiceDue: '2026-04-10' });
  });
});

describe('transfer', () => {
  it('moves stock between labs, creating or joining the item there', () => {
    fresh();
    A.addItem({ labId: 'chemistry', categoryId: 'glassware', name: 'Beaker', quantity: 20, unit: 'pcs', status: 'Good', custom: {} });
    const src = item('Beaker').id;
    const dest = A.transferStock(src, 'biology', 5);
    expect(getState().items.find((i) => i.id === src)!.quantity).toBe(15);
    expect(getState().items.find((i) => i.id === dest)).toMatchObject({ labId: 'biology', quantity: 5 });
    A.transferStock(src, 'biology', 3);
    expect(getState().items.filter((i) => i.labId === 'biology')).toHaveLength(1);
    expect(getState().items.find((i) => i.id === dest)!.quantity).toBe(8);
  });
});

describe('practicals', () => {
  it('records usage for every material, or nothing if one is short', () => {
    fresh();
    A.addItem({ labId: 'chemistry', categoryId: 'reagents', name: 'NaOH', quantity: 10, unit: 'g', status: 'Good', custom: {} });
    A.addItem({ labId: 'chemistry', categoryId: 'reagents', name: 'HCl', quantity: 100, unit: 'mL', status: 'Good', custom: {} });
    const pid = A.savePractical({ labId: 'chemistry', name: 'Titration', materials: [
      { itemId: item('NaOH').id, name: 'NaOH', qtyPerGroup: 2 },
      { itemId: item('HCl').id, name: 'HCl', qtyPerGroup: 5 },
    ] });
    expect(A.runPractical(pid, 4, { date: todayStr() })).toBe(2);
    expect(item('NaOH').quantity).toBe(2);
    const before = getState();
    expect(() => A.runPractical(pid, 4, { date: todayStr() })).toThrow(/Only 2 g/);
    expect(getState()).toBe(before);
  });
});

describe('stocktake', () => {
  it('applies only the differences', () => {
    fresh();
    A.addItem({ labId: 'physics', categoryId: 'consumables', name: 'Wire', quantity: 10, unit: 'm', status: 'Good', custom: {} });
    A.addItem({ labId: 'physics', categoryId: 'consumables', name: 'Tape', quantity: 5, unit: 'pcs', status: 'Good', custom: {} });
    const changed = A.finishStocktake('physics', 'All', [
      { itemId: item('Wire').id, expected: 10, counted: 8 },
      { itemId: item('Tape').id, expected: 5, counted: 5 },
    ]);
    expect(changed).toBe(1);
    expect(item('Wire').quantity).toBe(8);
    expect(getState().stocktakes).toHaveLength(1);
  });
});

describe('customisation', () => {
  it('will not delete a list that a field uses, or a category with items', () => {
    fresh();
    expect(() => A.deleteList('units')).toThrow(/Built-in/);
    const id = A.saveList({ name: 'My list', options: ['a', 'b'] });
    const m = getState().modules.find((x) => x.id === 'usage')!;
    A.saveModule({ ...m, fields: [...m.fields, { id: 'cf1', label: 'Mine', type: 'select', listId: id }] });
    expect(() => A.deleteList(id)).toThrow(/used by/);
    A.addItem({ labId: 'physics', categoryId: 'instruments', name: 'X', quantity: 0, unit: 'pcs', status: 'Good', custom: {} });
    expect(() => A.deleteCategory('instruments')).toThrow(/1 items use/);
  });
  it('a custom log keeps its own fields and never touches stock', () => {
    fresh();
    const id = A.saveModule({ name: 'Fridge', singular: 'Reading', kind: 'custom', icon: 'thermometer', builtin: false, enabled: true, labIds: ['biology'], dateFieldId: 'date', listFieldIds: ['date', 'temp'],
      fields: [{ id: 'date', label: 'Date', type: 'date', required: true }, { id: 'temp', label: 'Temp', type: 'number', required: true }] });
    A.saveRecord(id, 'biology', { date: todayStr(), temp: '4.5' });
    expect(getState().records[0].values.temp).toBe(4.5);
  });
  it('a new lab can copy another lab’s setup', () => {
    fresh();
    const id = A.saveLab({ name: 'Junior Science', short: 'JSC', color: '#000', icon: 'beaker' }, 'chemistry');
    expect(getState().labs.find((l) => l.id === id)!.locations.length).toBeGreaterThan(3);
    expect(getState().categories.find((c) => c.id === 'reagents')!.labIds).toContain(id);
    expect(() => A.saveLab({ name: 'Other', short: 'jsc', color: '#000', icon: 'beaker' })).toThrow(/used by another lab/);
  });
});

describe('import', () => {
  it('maps headings, categories, custom fields, dates and hazards', () => {
    const s = fresh();
    const table = parseTable(
      'Name\tCategory\tQty\tUnit\tLocation\tExpiry\tHazards\tCAS number\tStorage group\n' +
        'Sodium hydroxide\tChemicals & reagents\t500\tg\tAlkali shelf\t31/03/2028\tcorrosive; toxic\t1310-73-2\tBases\n' +
        'Mystery\tNo such category\tlots\t\t\t\t\t\t\n' +
        '\t\t5\t\t\t\t\t\t',
    );
    const r = mapTable(s, 'chemistry', table, 'reagents');
    expect(r.items).toHaveLength(2);
    expect(r.items[0]).toMatchObject({ name: 'Sodium hydroxide', quantity: 500, unit: 'g', expiry: '2028-03-31', hazards: ['Corrosive', 'Toxic'], storageGroup: 'Bases' });
    expect(r.items[0].custom.cas).toBe('1310-73-2');
    expect(r.problems.join(' ')).toMatch(/category "No such category"/);
    expect(r.problems.join(' ')).toMatch(/quantity "lots"/);
    expect(r.skipped).toBe(1);
  });
  it('explains a missing Name column', () => {
    const s = fresh();
    expect(mapTable(s, 'physics', [['Foo'], ['bar']], 'instruments').problems[0]).toMatch(/no "Name" column/);
  });
  it('imports the mapped items', () => {
    const s = fresh();
    const r = mapTable(s, 'physics', [['Name', 'Qty'], ['Lens', '4'], ['Mirror', '2']], 'optics');
    expect(A.importItems(r.items)).toBe(2);
    expect(getState().items.map((i) => i.code)).toEqual(['PHY-OPT-0001', 'PHY-OPT-0002']);
  });
});

describe('storage', () => {
  it('migrates older saved data without losing it', () => {
    const old = emptyState();
    old.modules = old.modules.map((m) => (m.id === 'usage' ? { ...m, fields: m.fields.filter((f) => f.id !== 'purpose') } : m));
    old.lists = old.lists.filter((l) => l.id !== 'priority');
    const m = migrate(old);
    expect(m.modules.find((x) => x.id === 'usage')!.fields.some((f) => f.id === 'purpose')).toBe(true);
    expect(m.lists.some((l) => l.id === 'priority')).toBe(true);
  });
});

describe('first-run setup and backups', () => {
  it('sets up only the chosen labs, plus extra ones, with sample data for just those labs', () => {
    A.completeSetup({ schoolName: 'Test School', labIds: ['physics'], extraLabs: ['Computer Lab'], sample: true });
    const s = getState();
    expect(s.settings.schoolName).toBe('Test School');
    expect(s.labs.map((l) => l.id)).toEqual(['physics', 'computer-lab']);
    expect(s.items.length).toBeGreaterThan(5);
    expect(s.items.every((i) => i.labId === 'physics')).toBe(true);
    expect(s.categories.find((c) => c.id === 'glassware')!.labIds).toContain('computer-lab');
    expect(s.setupDone).toBe(true);
    expect(computeAlerts(s).length).toBeGreaterThan(0);
  });
  it('can start empty', () => {
    A.completeSetup({ schoolName: '', labIds: ['chemistry', 'biology'], extraLabs: [], sample: false });
    expect(getState().items).toHaveLength(0);
    expect(getState().settings.schoolName).toBe('Our School');
  });
  it('clearing data keeps the customisation', () => {
    A.completeSetup({ schoolName: 'S', labIds: ['physics', 'chemistry', 'biology'], extraLabs: [], sample: true });
    A.saveList({ name: 'Mine', options: ['a'] });
    A.clearData();
    const s = getState();
    expect(s.items).toHaveLength(0);
    expect(s.records).toHaveLength(0);
    expect(s.sample).toBe(false);
    expect(s.lists.some((l) => l.name === 'Mine')).toBe(true);
    expect(s.labs).toHaveLength(3);
  });
  it('a backup survives a round trip', async () => {
    A.completeSetup({ schoolName: 'Round trip', labIds: ['physics', 'chemistry', 'biology'], extraLabs: [], sample: true });
    const { exportJSON } = await import('../store/store');
    const before = exportJSON();
    A.clearData();
    replaceState(JSON.parse(before));
    expect(exportJSON()).toBe(before);
    expect(getState().items.length).toBeGreaterThan(30);
  });
});
