import { addDays, stamp, todayStr } from './dates';
import { uid } from './ids';
import { nextCode } from './inventory';
import type { AppState, Item, LabRecord, StockTxn, TxnType, Values } from './types';

interface Ev {
  itemId: string;
  type: TxnType;
  delta: number;
  daysAgo: number;
  note?: string;
  recordId?: string;
}

/** Demo data so the app can be tried straight away. Dates are relative to today so it always looks current. */
export function buildSample(base: AppState): AppState {
  const s: AppState = structuredClone(base);
  s.sample = true;
  const today = todayStr();
  const d = (n: number) => addDays(today, n);
  const has = (id: string) => s.labs.some((l) => l.id === id);
  const events: Ev[] = [];
  const byName = new Map<string, Item>();

  s.people = [
    { id: uid('pe'), name: 'Ms. R. Sharma', role: 'Teacher', group: 'Physics', active: true },
    { id: uid('pe'), name: 'Mr. A. Verma', role: 'Teacher', group: 'Physics', active: true },
    { id: uid('pe'), name: 'Dr. S. Iyer', role: 'Teacher', group: 'Chemistry', active: true },
    { id: uid('pe'), name: 'Mrs. P. Nair', role: 'Teacher', group: 'Biology', active: true },
    { id: uid('pe'), name: 'Mr. K. Das', role: 'Lab assistant', group: 'All labs', active: true },
  ];
  s.suppliers = [
    { id: uid('su'), name: 'Scientific Supplies Co.', contact: 'Sales desk', phone: '000 000 0001', email: 'sales@example.com', notes: 'Glassware and instruments' },
    { id: uid('su'), name: 'EduChem Traders', contact: 'Order desk', phone: '000 000 0002', notes: 'Chemicals. Delivery in 5 working days.' },
    { id: uid('su'), name: 'BioLab Mart', phone: '000 000 0003', notes: 'Slides, stains, media' },
  ];

  interface Spec {
    lab: string; cat: string; name: string; qty: number; unit: string; loc: string;
    min?: number; target?: number; cost?: number; supplier?: string; status?: string;
    expiry?: number; lot?: string; hazards?: string[]; group?: string; custom?: Values;
    every?: number; last?: number; next?: number; desc?: string;
  }
  const specs: Spec[] = [
    // ---------- Physics
    { lab: 'physics', cat: 'instruments', name: 'Vernier calipers', qty: 12, unit: 'pcs', loc: 'Cupboard A', cost: 350, supplier: 'Scientific Supplies Co.', every: 365, last: -400, next: -35, custom: { make: 'Precision', range: '0–150 mm, LC 0.02 mm' } },
    { lab: 'physics', cat: 'instruments', name: 'Screw gauge (micrometer)', qty: 10, unit: 'pcs', loc: 'Cupboard A', cost: 420, supplier: 'Scientific Supplies Co.', custom: { range: '0–25 mm, LC 0.01 mm' } },
    { lab: 'physics', cat: 'instruments', name: 'Digital multimeter', qty: 8, unit: 'pcs', loc: 'Electricity bench', cost: 1100, every: 365, last: -345, next: 20, custom: { make: 'Meco', model: '450B' } },
    { lab: 'physics', cat: 'instruments', name: 'Stopwatch', qty: 15, unit: 'pcs', loc: 'Cupboard A', cost: 250, custom: { range: '0.01 s' } },
    { lab: 'physics', cat: 'instruments', name: 'Spring balance 0–1 kg', qty: 10, unit: 'pcs', loc: 'Cupboard B', cost: 180, status: 'Needs attention' },
    { lab: 'physics', cat: 'instruments', name: 'Resistance box', qty: 6, unit: 'pcs', loc: 'Electricity bench', cost: 900, status: 'Under repair' },
    { lab: 'physics', cat: 'optics', name: 'Convex lens set (f = 10, 15, 20 cm)', qty: 14, unit: 'set', loc: 'Optics shelf', cost: 300, custom: { focal: '10 / 15 / 20 cm' } },
    { lab: 'physics', cat: 'optics', name: 'Glass prism (equilateral)', qty: 12, unit: 'pcs', loc: 'Optics shelf', cost: 150 },
    { lab: 'physics', cat: 'optics', name: 'Bar magnet pair', qty: 16, unit: 'pair', loc: 'Cupboard B', cost: 120 },
    { lab: 'physics', cat: 'electrical', name: 'Dry cell 1.5 V (AA)', qty: 6, unit: 'pcs', loc: 'Electricity bench', min: 20, target: 60, cost: 15, expiry: 200, custom: { rating: '1.5 V' } },
    { lab: 'physics', cat: 'electrical', name: 'Nichrome wire 28 SWG', qty: 4, unit: 'm', loc: 'Electricity bench', min: 3, target: 10, cost: 25, custom: { rating: '28 SWG' } },
    { lab: 'physics', cat: 'electrical', name: 'Connecting wires (set)', qty: 40, unit: 'pcs', loc: 'Electricity bench', min: 20, target: 60, cost: 20 },
    { lab: 'physics', cat: 'safety', name: 'Fire extinguisher (CO₂)', qty: 2, unit: 'pcs', loc: 'Store room', cost: 3200, every: 365, last: -300, next: 65, expiry: 400, custom: { type: 'Fire extinguisher' } },

    // ---------- Chemistry
    { lab: 'chemistry', cat: 'reagents', name: 'Hydrochloric acid (conc.)', qty: 350, unit: 'mL', loc: 'Acid cabinet', min: 500, target: 2500, cost: 0.4, supplier: 'EduChem Traders', expiry: 500, lot: 'HC-2291', hazards: ['Corrosive', 'Harmful / irritant'], group: 'Acids', custom: { cas: '7647-01-0', formula: 'HCl', state: 'Liquid', conc: '35%', grade: 'Laboratory (LR)', storage: 'Fume hood / ventilated' } },
    { lab: 'chemistry', cat: 'reagents', name: 'Sulphuric acid (conc.)', qty: 1800, unit: 'mL', loc: 'Acid cabinet', min: 500, target: 2500, cost: 0.5, supplier: 'EduChem Traders', expiry: 700, hazards: ['Corrosive'], group: 'Acids', custom: { cas: '7664-93-9', formula: 'H₂SO₄', state: 'Liquid', conc: '98%' } },
    { lab: 'chemistry', cat: 'reagents', name: 'Glacial acetic acid', qty: 450, unit: 'mL', loc: 'Acid cabinet', min: 250, cost: 0.6, expiry: 600, hazards: ['Corrosive', 'Flammable'], group: 'Acids', custom: { cas: '64-19-7', formula: 'CH₃COOH' } },
    { lab: 'chemistry', cat: 'reagents', name: 'Ammonia solution', qty: 900, unit: 'mL', loc: 'Acid cabinet', min: 250, cost: 0.3, expiry: 300, hazards: ['Corrosive', 'Environmental hazard'], group: 'Bases', desc: 'Stored in the acid cabinet by mistake: should move to the alkali shelf.', custom: { cas: '1336-21-6', formula: 'NH₄OH' } },
    { lab: 'chemistry', cat: 'reagents', name: 'Sodium hydroxide pellets', qty: 780, unit: 'g', loc: 'Alkali shelf', min: 250, target: 1500, cost: 0.9, supplier: 'EduChem Traders', expiry: 900, lot: 'NH-1104', hazards: ['Corrosive'], group: 'Bases', custom: { cas: '1310-73-2', formula: 'NaOH', state: 'Solid', grade: 'Analytical (AR)', storage: 'Cool and dry' } },
    { lab: 'chemistry', cat: 'reagents', name: 'Ethanol (absolute)', qty: 2000, unit: 'mL', loc: 'Flammables cabinet', min: 1000, target: 5000, cost: 0.35, expiry: 365, hazards: ['Flammable'], group: 'Flammables', custom: { cas: '64-17-5', formula: 'C₂H₅OH', state: 'Liquid' } },
    { lab: 'chemistry', cat: 'reagents', name: 'Potassium permanganate', qty: 180, unit: 'g', loc: 'Reagent shelf 1', min: 100, cost: 1.2, expiry: 800, hazards: ['Oxidising', 'Harmful / irritant', 'Environmental hazard'], group: 'Oxidisers', custom: { cas: '7722-64-7', formula: 'KMnO₄', state: 'Solid' } },
    { lab: 'chemistry', cat: 'reagents', name: 'Copper(II) sulphate pentahydrate', qty: 620, unit: 'g', loc: 'Reagent shelf 1', min: 200, cost: 0.5, expiry: 1000, hazards: ['Harmful / irritant', 'Environmental hazard'], group: 'Inorganic salts', custom: { cas: '7758-99-8', formula: 'CuSO₄·5H₂O', state: 'Solid' } },
    { lab: 'chemistry', cat: 'reagents', name: 'Silver nitrate', qty: 15, unit: 'g', loc: 'Reagent shelf 2', min: 10, target: 50, cost: 25, expiry: 400, hazards: ['Oxidising', 'Corrosive', 'Environmental hazard'], group: 'Oxidisers', custom: { cas: '7761-88-8', formula: 'AgNO₃', storage: 'Dark bottle' } },
    { lab: 'chemistry', cat: 'reagents', name: 'Phenolphthalein indicator', qty: 80, unit: 'mL', loc: 'Reagent shelf 2', min: 30, cost: 1, expiry: -10, hazards: ['Health hazard'], group: 'Stains & dyes', custom: { conc: '1% in ethanol' } },
    { lab: 'chemistry', cat: 'reagents', name: "Benedict's reagent", qty: 250, unit: 'mL', loc: 'Reagent shelf 2', min: 100, cost: 0.6, expiry: 25, hazards: ['Harmful / irritant'], group: 'Inorganic salts' },
    { lab: 'chemistry', cat: 'glassware', name: 'Beaker 250 mL', qty: 38, unit: 'pcs', loc: 'Glassware cupboard', min: 30, target: 60, cost: 90, supplier: 'Scientific Supplies Co.', custom: { capacity: '250 mL', material: 'Borosilicate glass', graduated: true } },
    { lab: 'chemistry', cat: 'glassware', name: 'Burette 50 mL', qty: 6, unit: 'pcs', loc: 'Glassware cupboard', min: 10, target: 15, cost: 650, custom: { capacity: '50 mL', material: 'Borosilicate glass', graduated: true } },
    { lab: 'chemistry', cat: 'glassware', name: 'Conical flask 250 mL', qty: 30, unit: 'pcs', loc: 'Glassware cupboard', min: 20, cost: 110, custom: { capacity: '250 mL', material: 'Borosilicate glass' } },
    { lab: 'chemistry', cat: 'glassware', name: 'Test tubes 150×25 mm', qty: 180, unit: 'pcs', loc: 'Glassware cupboard', min: 100, target: 300, cost: 12 },
    { lab: 'chemistry', cat: 'instruments', name: 'Digital balance (0.01 g)', qty: 2, unit: 'pcs', loc: 'Prep room', cost: 6500, every: 180, last: -100, next: 80, custom: { make: 'Contech', range: '0–600 g, 0.01 g' } },
    { lab: 'chemistry', cat: 'instruments', name: 'Bunsen burner', qty: 14, unit: 'pcs', loc: 'Prep room', cost: 450 },
    { lab: 'chemistry', cat: 'consumables', name: 'Universal indicator paper', qty: 6, unit: 'pack', loc: 'Reagent shelf 2', min: 5, cost: 80, expiry: 500 },
    { lab: 'chemistry', cat: 'safety', name: 'Safety goggles', qty: 34, unit: 'pcs', loc: 'Prep room', min: 40, target: 45, cost: 120 },
    { lab: 'chemistry', cat: 'safety', name: 'Eye-wash station', qty: 1, unit: 'pcs', loc: 'Prep room', every: 30, last: -50, next: -20, cost: 4800, custom: { type: 'Eye-wash' } },

    // ---------- Biology
    { lab: 'biology', cat: 'instruments', name: 'Compound microscope', qty: 14, unit: 'pcs', loc: 'Microscope cupboard', cost: 9500, every: 365, last: -150, next: 215, supplier: 'BioLab Mart', custom: { make: 'Olympus', model: 'CX23', range: '40×–1000×' } },
    { lab: 'biology', cat: 'instruments', name: 'Dissection kit', qty: 10, unit: 'set', loc: 'Dissection store', cost: 750 },
    { lab: 'biology', cat: 'specimens', name: 'Prepared slides: plant tissues', qty: 24, unit: 'pcs', loc: 'Slide cabinet', cost: 60, custom: { preservation: 'Prepared slide' } },
    { lab: 'biology', cat: 'specimens', name: 'Prepared slides: animal tissues', qty: 20, unit: 'pcs', loc: 'Slide cabinet', cost: 60, custom: { preservation: 'Prepared slide' } },
    { lab: 'biology', cat: 'specimens', name: 'Frog specimen (preserved)', qty: 5, unit: 'pcs', loc: 'Specimen shelf', cost: 450, hazards: ['Health hazard'], group: 'Preserved specimens', custom: { sci: 'Rana tigrina', preservation: 'Formalin' } },
    { lab: 'biology', cat: 'media', name: 'Methylene blue stain', qty: 90, unit: 'mL', loc: 'Reagent shelf 1', min: 50, cost: 1, expiry: 450, hazards: ['Harmful / irritant'], group: 'Stains & dyes' },
    { lab: 'biology', cat: 'media', name: 'Safranin stain', qty: 30, unit: 'mL', loc: 'Reagent shelf 1', min: 50, target: 150, cost: 1, expiry: 400, hazards: ['Harmful / irritant'], group: 'Stains & dyes' },
    { lab: 'biology', cat: 'media', name: 'Nutrient agar powder', qty: 250, unit: 'g', loc: 'Fridge', min: 100, cost: 3, expiry: 30, group: 'Cultures & media', custom: { storage: 'Cool and dry' } },
    { lab: 'biology', cat: 'reagents', name: 'Formalin 5%', qty: 1500, unit: 'mL', loc: 'Specimen shelf', min: 500, cost: 0.25, expiry: 500, hazards: ['Toxic', 'Health hazard', 'Corrosive'], group: 'Toxic / poisons', custom: { cas: '50-00-0', state: 'Solution', conc: '5%' } },
    { lab: 'biology', cat: 'glassware', name: 'Petri dish (glass, 90 mm)', qty: 40, unit: 'pcs', loc: 'Prep room', min: 30, cost: 70, custom: { material: 'Borosilicate glass' } },
    { lab: 'biology', cat: 'glassware', name: 'Glass slides (blank, 75×25 mm)', qty: 60, unit: 'pcs', loc: 'Slide cabinet', min: 100, target: 300, cost: 3 },
    { lab: 'biology', cat: 'consumables', name: 'Nitrile gloves (M)', qty: 120, unit: 'pcs', loc: 'Prep room', min: 100, target: 400, cost: 6, expiry: 700 },
    { lab: 'biology', cat: 'models', name: 'Human skeleton model', qty: 1, unit: 'pcs', loc: 'Specimen shelf', cost: 8500, custom: { topic: 'Skeletal system' } },
    { lab: 'biology', cat: 'models', name: 'Wall chart: human heart', qty: 2, unit: 'pcs', loc: 'Prep room', cost: 150, custom: { topic: 'Circulation' } },
  ];

  for (const sp of specs) {
    if (!has(sp.lab) || !s.categories.some((c) => c.id === sp.cat)) continue;
    const code = nextCode(s, sp.lab, sp.cat);
    const at = stamp(new Date(Date.now() - 60 * 86400000));
    const item: Item = {
      id: uid('i'), labId: sp.lab, categoryId: sp.cat, name: sp.name, code, description: sp.desc, quantity: sp.qty, unit: sp.unit,
      minStock: sp.min, targetStock: sp.target, location: sp.loc, supplier: sp.supplier, unitCost: sp.cost,
      purchaseDate: d(-120), status: sp.status ?? 'Good', lot: sp.lot, expiry: sp.expiry != null ? d(sp.expiry) : undefined,
      hazards: sp.hazards, storageGroup: sp.group, serviceEveryDays: sp.every,
      lastServiced: sp.last != null ? d(sp.last) : undefined, nextServiceDue: sp.next != null ? d(sp.next) : undefined,
      custom: sp.custom ?? {}, createdAt: at, updatedAt: at,
    };
    s.items.push(item);
    byName.set(sp.name, item);
  }
  if (!s.items.length) return s;

  const rec = (moduleId: string, labId: string, values: Values, daysAgo: number): LabRecord | undefined => {
    if (!has(labId) || !s.modules.some((m) => m.id === moduleId)) return undefined;
    const at = stamp(new Date(Date.now() - daysAgo * 86400000));
    const r: LabRecord = { id: uid('r'), moduleId, labId, values, createdAt: at, updatedAt: at, by: 'Mr. K. Das' };
    s.records.push(r);
    return r;
  };
  const id = (name: string) => byName.get(name)?.id;
  const use = (labId: string, name: string, qty: number, daysAgo: number, practical: string, cls: string, user: string) => {
    const it = byName.get(name);
    if (!it) return;
    const r = rec('usage', labId, { date: d(-daysAgo), item: it.id, quantity: qty, practical, purpose: 'Class practical', class: cls, user, students: 8 }, daysAgo);
    if (r) events.push({ itemId: it.id, type: 'use', delta: -qty, daysAgo, note: `Usage: ${practical}`, recordId: r.id });
  };
  const lose = (moduleId: string, type: TxnType, labId: string, name: string, qty: number, daysAgo: number, values: Values, label: string) => {
    const it = byName.get(name);
    if (!it) return;
    const r = rec(moduleId, labId, { item: it.id, quantity: qty, ...values }, daysAgo);
    if (r) events.push({ itemId: it.id, type, delta: -qty, daysAgo, note: label, recordId: r.id });
  };

  // Usage
  use('physics', 'Dry cell 1.5 V (AA)', 12, 6, "Ohm's law", 'Class 10', 'Ms. R. Sharma');
  use('physics', 'Nichrome wire 28 SWG', 2, 6, "Ohm's law", 'Class 10', 'Ms. R. Sharma');
  use('physics', 'Dry cell 1.5 V (AA)', 8, 20, 'Resistors in series and parallel', 'Class 12', 'Mr. A. Verma');
  use('chemistry', 'Sodium hydroxide pellets', 40, 3, 'Acid–base titration', 'Class 11', 'Dr. S. Iyer');
  use('chemistry', 'Hydrochloric acid (conc.)', 150, 3, 'Acid–base titration', 'Class 11', 'Dr. S. Iyer');
  use('chemistry', 'Phenolphthalein indicator', 6, 3, 'Acid–base titration', 'Class 11', 'Dr. S. Iyer');
  use('chemistry', 'Copper(II) sulphate pentahydrate', 60, 11, 'Crystallisation', 'Class 10', 'Dr. S. Iyer');
  use('chemistry', 'Ethanol (absolute)', 500, 14, 'Distillation', 'Class 12', 'Dr. S. Iyer');
  use('biology', 'Methylene blue stain', 10, 4, 'Onion peel mounting', 'Class 9', 'Mrs. P. Nair');
  use('biology', 'Nitrile gloves (M)', 40, 4, 'Onion peel mounting', 'Class 9', 'Mrs. P. Nair');
  use('biology', 'Safranin stain', 20, 18, 'Stem cross-section', 'Class 11', 'Mrs. P. Nair');

  // Breakage, spills, disposal
  lose('breakage', 'breakage', 'chemistry', 'Beaker 250 mL', 3, 20, { date: d(-20), cause: 'Student mishap', who: 'Aarav Mehta', class: 'Class 9', replace: true, fine: 270, fineStatus: 'Pending' }, 'Breakage');
  lose('breakage', 'breakage', 'chemistry', 'Burette 50 mL', 2, 25, { date: d(-25), cause: 'Dropped', who: 'Diya Nair', replace: true, class: 'Class 11', fine: 650, fineStatus: 'Paid', finePaidOn: d(-18), fineNote: 'Receipt 1042' }, 'Breakage');
  lose('breakage', 'breakage', 'biology', 'Glass slides (blank, 75×25 mm)', 15, 7, { date: d(-7), cause: 'Student mishap', who: 'Rohan Das', class: 'Class 11', replace: true, fine: 45, fineStatus: 'Waived', fineNote: 'Slides were already cracked in the box' }, 'Breakage');
  lose('disposal', 'dispose', 'chemistry', 'Phenolphthalein indicator', 20, 40, { date: d(-40), reason: 'Expired', method: 'Collected as hazardous waste', by: 'Mr. K. Das' }, 'Disposal');
  lose('spill', 'spill', 'chemistry', 'Hydrochloric acid (conc.)', 100, 12, { when: `${d(-12)}T11:20`, severity: 'Minor', place: 'Student bench 4', cause: 'Bottle knocked over', cleanup: 'Neutralised', ppe: 'Gloves, goggles, apron', exposure: false, deduct: true, status: 'Closed', reporter: 'Dr. S. Iyer', description: 'Neutralised with sodium bicarbonate and wiped. Nobody was hurt.' }, 'Spill');
  lose('spill', 'spill', 'chemistry', 'Ethanol (absolute)', 250, 2, { when: `${d(-2)}T14:05`, severity: 'Moderate', place: 'Flammables cabinet', cause: 'Bottle cap not tightened', cleanup: 'Absorbed with spill kit', exposure: false, deduct: true, status: 'Open', followUp: d(-1), reporter: 'Mr. K. Das', description: 'Found leaking during the weekly check. Cabinet ventilated, no ignition sources nearby.' }, 'Spill');

  // Accidents
  rec('incident', 'chemistry', { when: `${d(-12)}T11:25`, type: 'Chemical on skin or eyes', severity: 'Moderate', involved: 'Student, Class 11A', description: 'A few drops of dilute HCl splashed onto a student’s forearm during titration.', firstAid: 'Rinsed under running water for 10 minutes. Redness faded.', medical: false, parents: true, reportedTo: 'Principal', reporter: 'Dr. S. Iyer', cause: 'Burette tap opened too fast; gloves not worn.', corrective: 'Gloves compulsory for all titrations. Reminder given to the class.', followUp: d(-5), status: 'Under review' }, 12);
  rec('incident', 'physics', { when: `${d(-30)}T10:10`, type: 'Burn / scald', severity: 'Minor', involved: 'Student, Class 12', description: 'Touched the hot tip of a soldering iron.', firstAid: 'Cool running water, burn cream.', medical: false, parents: true, reporter: 'Ms. R. Sharma', cause: 'Iron left plugged in without a stand.', corrective: 'Stands provided at every bench.', status: 'Closed' }, 30);
  rec('incident', 'biology', { when: `${d(-45)}T12:00`, type: 'Near miss', severity: 'Minor', description: 'Dissection scalpel left on the edge of the bench.', reporter: 'Mrs. P. Nair', corrective: 'Count blades in and out.', status: 'Closed' }, 45);

  // Loans
  const lens = id('Convex lens set (f = 10, 15, 20 cm)');
  if (lens) rec('loan', 'physics', { issued: d(-12), item: lens, quantity: 10, borrower: 'Mr. A. Verma', group: 'Class 12', purpose: 'Class practical', due: d(-5) }, 12);
  const sw = id('Stopwatch');
  if (sw) rec('loan', 'physics', { issued: d(-1), item: sw, quantity: 6, borrower: 'Ms. R. Sharma', group: 'Class 9', purpose: 'Class practical', due: d(2) }, 1);
  const mm = id('Digital multimeter');
  if (mm) rec('loan', 'physics', { issued: d(-20), item: mm, quantity: 2, borrower: 'Mr. A. Verma', purpose: 'Project work', due: d(-15), returned: d(-14), condition: 'Good' }, 20);
  const mic = id('Compound microscope');
  if (mic) rec('loan', 'biology', { issued: d(0), item: mic, quantity: 4, borrower: 'Mrs. P. Nair', group: 'Class 11', purpose: 'Class practical', due: d(1) }, 0);

  // Maintenance history
  const vc = id('Vernier calipers');
  if (vc) rec('maintenance', 'physics', { date: d(-400), item: vc, type: 'Calibration', result: 'Passed / OK', by: 'Scientific Supplies Co.', nextDue: d(-35) }, 400);
  if (mm) rec('maintenance', 'physics', { date: d(-345), item: mm, type: 'Calibration', result: 'Passed / OK', by: 'Mr. K. Das', nextDue: d(20) }, 345);
  const ew = id('Eye-wash station');
  if (ew) rec('maintenance', 'chemistry', { date: d(-50), item: ew, type: 'Safety inspection', result: 'Needs follow-up', by: 'Mr. K. Das', nextDue: d(-20), notes: 'Flow weak on the left nozzle.' }, 50);

  // Requirements
  rec('requisition', 'chemistry', { requested: d(-8), item: id('Burette 50 mL'), name: 'Burette 50 mL', quantity: 9, unit: 'pcs', priority: 'Urgent', reason: 'Class 11 titration practicals', by: 'Dr. S. Iyer', supplier: 'Scientific Supplies Co.', estCost: 5850, status: 'Approved' }, 8);
  rec('requisition', 'chemistry', { requested: d(-3), item: id('Hydrochloric acid (conc.)'), name: 'Hydrochloric acid (conc.)', quantity: 2000, unit: 'mL', priority: 'Normal', reason: 'Below reorder level', by: 'Mr. K. Das', supplier: 'EduChem Traders', status: 'Requested' }, 3);
  rec('requisition', 'physics', { requested: d(-15), name: 'Digital multimeter', quantity: 4, unit: 'pcs', priority: 'Normal', reason: 'Class 12 circuits practical', by: 'Mr. A. Verma', estCost: 4400, status: 'Ordered', po: 'PO-0412' }, 15);
  rec('requisition', 'biology', { requested: d(-2), name: 'Microscope lamp bulbs', quantity: 10, unit: 'pcs', priority: 'Low', by: 'Mrs. P. Nair', status: 'Requested' }, 2);

  // Sessions and diary
  rec('session', 'chemistry', { date: d(-3), period: 'Period 3–4', class: 'Class 11', teacher: 'Dr. S. Iyer', topic: 'Acid–base titration', students: 32 }, 3);
  rec('session', 'physics', { date: d(-6), period: 'Period 5', class: 'Class 10', teacher: 'Ms. R. Sharma', topic: "Ohm's law", students: 30 }, 6);
  rec('diary', 'chemistry', { date: d(-1), category: 'Safety', title: 'Weekly chemical store walk-through', note: 'Found the ethanol leak. Ammonia is in the acid cabinet: needs moving.', by: 'Mr. K. Das' }, 1);
  rec('diary', 'biology', { date: d(-5), category: 'Delivery / supplier', title: 'Slides delivered', note: 'Box of 100 blank slides arrived, 2 cracked.', by: 'Mr. K. Das' }, 5);

  // A custom log, to show what "Customise → Forms" can do
  if (has('biology')) {
    s.modules.push({
      id: 'x-fridge-temp', kind: 'custom', name: 'Fridge temperature', singular: 'Reading', icon: 'thermometer', builtin: false, enabled: true, labIds: ['biology'],
      description: 'Daily temperature check of the specimen and media fridge. Edit or delete this log under Customise → Forms.',
      dateFieldId: 'date', listFieldIds: ['date', 'temp', 'ok', 'by'], order: 50,
      fields: [
        { id: 'date', label: 'Date', type: 'date', required: true, default: '@today' },
        { id: 'temp', label: 'Temperature', type: 'number', unit: '°C', required: true },
        { id: 'ok', label: 'Within 2–8 °C', type: 'checkbox', default: true },
        { id: 'by', label: 'Checked by', type: 'person' },
        { id: 'notes', label: 'Notes', type: 'textarea', full: true },
      ],
    });
    for (let n = 0; n < 5; n++) rec('x-fridge-temp', 'biology', { date: d(-n), temp: [4.5, 5, 3.8, 9.2, 4.9][n], ok: n !== 3, by: 'Mr. K. Das', notes: n === 3 ? 'Door left ajar overnight.' : undefined }, n);
  }

  // Practical planner
  const mat = (name: string, qty: number, unit?: string) => ({ itemId: id(name), name, qtyPerGroup: qty, unit });
  const prac = (labId: string, name: string, level: string, mins: number, safety: string, materials: ReturnType<typeof mat>[]) => {
    if (!has(labId)) return;
    s.practicals.push({ id: uid('p'), labId, name, level, durationMin: mins, safety, materials: materials.filter((m) => m.itemId), createdAt: stamp() });
  };
  prac('chemistry', 'Acid–base titration', 'Class 11', 80, 'Gloves and goggles compulsory. Never mouth-pipette.', [
    mat('Sodium hydroxide pellets', 2, 'g'), mat('Hydrochloric acid (conc.)', 5, 'mL'), mat('Phenolphthalein indicator', 1, 'mL'),
    mat('Burette 50 mL', 1, 'pcs'), mat('Conical flask 250 mL', 2, 'pcs'), mat('Beaker 250 mL', 2, 'pcs'),
  ]);
  prac('physics', "Verification of Ohm's law", 'Class 10', 60, 'Switch off the supply before changing connections.', [
    mat('Dry cell 1.5 V (AA)', 2, 'pcs'), mat('Nichrome wire 28 SWG', 0.5, 'm'), mat('Connecting wires (set)', 6, 'pcs'), mat('Digital multimeter', 1, 'pcs'),
  ]);
  prac('biology', 'Onion peel mounting', 'Class 9', 45, 'Handle slides and cover slips with care. Gloves for stains.', [
    mat('Methylene blue stain', 1, 'mL'), mat('Glass slides (blank, 75×25 mm)', 2, 'pcs'), mat('Compound microscope', 1, 'pcs'), mat('Nitrile gloves (M)', 4, 'pcs'),
  ]);

  // Build the ledger: opening stock, then every event in date order, ending at the quantity chosen above.
  const txns: StockTxn[] = [];
  for (const it of s.items) {
    const evs = events.filter((e) => e.itemId === it.id).sort((a, b) => b.daysAgo - a.daysAgo);
    const final = it.quantity;
    const opening = final - evs.reduce((n, e) => n + e.delta, 0);
    let bal = opening;
    const t0 = stamp(new Date(Date.now() - 60 * 86400000));
    if (opening > 0) txns.push({ id: uid('t'), itemId: it.id, labId: it.labId, at: t0, type: 'opening', delta: opening, balance: opening, note: 'Opening stock' });
    for (const e of evs) {
      bal = Math.round((bal + e.delta) * 1e6) / 1e6;
      txns.push({ id: uid('t'), itemId: it.id, labId: it.labId, at: stamp(new Date(Date.now() - e.daysAgo * 86400000)), type: e.type, delta: e.delta, balance: bal, note: e.note, recordId: e.recordId });
    }
  }
  s.txns = txns;
  s.activity = [
    { id: uid('a'), at: stamp(), text: 'Sample data loaded. Clear it from Customise → Data when you are ready to enter your own.' },
  ];
  return s;
}
