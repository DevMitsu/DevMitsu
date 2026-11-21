import { describe, expect, it } from 'vitest';
import { computeAlerts } from './alerts';
import { emptyState } from './defaults';
import { uid } from './ids';
import type { AppState, Item, LabRecord } from './types';

function big(items: number, records: number): AppState {
  const s = emptyState();
  s.setupDone = true;
  for (let n = 0; n < items; n++) {
    s.items.push({
      id: `i${n}`, labId: ['physics', 'chemistry', 'biology'][n % 3], categoryId: n % 2 ? 'reagents' : 'instruments', name: `Item ${n}`, code: `C-${n}`,
      quantity: n % 7, unit: 'g', minStock: 3, status: 'Good', location: `Shelf ${n % 20}`, storageGroup: n % 2 ? ['Acids', 'Bases', 'Oxidisers'][n % 3] : undefined,
      expiry: '2027-01-01', custom: {}, createdAt: '2026-01-01T00:00:00', updatedAt: '2026-01-01T00:00:00',
    } as Item);
  }
  for (let n = 0; n < records; n++) {
    s.records.push({
      id: uid('r'), moduleId: n % 5 === 0 ? 'loan' : 'usage', labId: 'chemistry',
      values: { date: '2026-03-01', item: `i${n % items}`, quantity: 2, borrower: 'X', due: '2026-03-05', practical: 'Titration', class: 'Class 11' },
      createdAt: '2026-03-01T10:00:00', updatedAt: '2026-03-01T10:00:00',
    } as LabRecord);
  }
  return s;
}

describe('scale', () => {
  it('computes alerts quickly for a large lab (3,000 items, 20,000 log entries)', () => {
    const s = big(3000, 20000);
    const t = performance.now();
    const alerts = computeAlerts(s, '2026-11-21');
    const ms = performance.now() - t;
    console.log(`alerts: ${alerts.length} in ${ms.toFixed(0)} ms; saved size ${(JSON.stringify(s).length / 1e6).toFixed(1)} MB`);
    expect(ms).toBeLessThan(400);
  });
});
