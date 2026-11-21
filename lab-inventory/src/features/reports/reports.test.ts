import { describe, expect, it } from 'vitest';
import { emptyState } from '../../domain/defaults';
import { ALL } from '../../domain/inventory';
import { buildSample } from '../../domain/sample';
import { REPORTS } from './builders';

const state = buildSample({ ...emptyState(), setupDone: true });
const ctx = (scope = ALL, from = '0000', to = '9999') => ({ state, scope, from, to });

describe('reports', () => {
  it('every report builds on the sample data with matching column counts', () => {
    for (const r of REPORTS) {
      const t = r.build(ctx());
      expect(t.columns.length, r.id).toBeGreaterThan(2);
      for (const row of t.rows) expect(row.length, `${r.id} row width`).toBe(t.columns.length);
    }
  });

  it('can be limited to one lab', () => {
    const chem = REPORTS.find((r) => r.id === 'register')!.build(ctx('chemistry'));
    const all = REPORTS.find((r) => r.id === 'register')!.build(ctx());
    expect(chem.rows.length).toBeGreaterThan(0);
    expect(chem.rows.length).toBeLessThan(all.rows.length);
    expect(chem.rows.every((r) => r[0] === 'CHE')).toBe(true);
  });

  it('the reorder list only holds items at or below their reorder level', () => {
    const t = REPORTS.find((r) => r.id === 'reorder')!.build(ctx());
    expect(t.rows.length).toBeGreaterThan(3);
    for (const r of t.rows) expect(Number(r[3])).toBeLessThanOrEqual(Number(r[4]));
  });

  it('the expiry report lists expired and soon-to-expire items only', () => {
    const t = REPORTS.find((r) => r.id === 'expiry')!.build(ctx());
    expect(t.rows.length).toBeGreaterThan(0);
    expect(t.rows.some((r) => String(r[5]).includes('expired'))).toBe(true);
  });

  it('usage can be grouped by class and respects the date range', () => {
    const usage = REPORTS.find((r) => r.id === 'usage')!;
    const byClass = usage.build({ ...ctx(), groupBy: 'class' });
    expect(byClass.columns[0]).toBe('Class');
    expect(byClass.rows.map((r) => r[0])).toContain('Class 11');
    const none = usage.build(ctx(ALL, '2000-01-01', '2000-01-02'));
    expect(none.rows).toHaveLength(0);
  });

  it('the accident summary counts by severity', () => {
    const t = REPORTS.find((r) => r.id === 'incidents')!.build(ctx());
    expect(t.rows).toHaveLength(3);
    expect(t.notes?.join(' ')).toMatch(/By severity: .*Minor: 2/);
  });
});
