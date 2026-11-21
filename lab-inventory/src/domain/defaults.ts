import type { AppState, Category, FieldDef, Lab, ListDef, ModuleDef, Settings, Tone } from './types';

const f = (id: string, label: string, type: FieldDef['type'], extra: Partial<FieldDef> = {}): FieldDef => ({
  id,
  label,
  type,
  builtin: true,
  ...extra,
});

// ---------------------------------------------------------------- lists

const L = (
  id: string,
  name: string,
  options: string[],
  tones?: Record<string, Tone>,
  description?: string,
): ListDef => ({ id, name, options, tones, description, builtin: true });

export const DEFAULT_LISTS: ListDef[] = [
  L('units', 'Units', ['pcs', 'g', 'kg', 'mg', 'mL', 'L', 'set', 'box', 'pack', 'bottle', 'roll', 'pair', 'm', 'sheet'], undefined, 'How quantities are counted.'),
  L('itemStatus', 'Item status', ['Good', 'Needs attention', 'Under repair', 'Out of service', 'Quarantined'], {
    Good: 'green',
    'Needs attention': 'amber',
    'Under repair': 'amber',
    'Out of service': 'red',
    Quarantined: 'red',
  }),
  L(
    'hazards',
    'Hazard labels',
    ['Flammable', 'Corrosive', 'Toxic', 'Oxidising', 'Explosive', 'Harmful / irritant', 'Health hazard', 'Environmental hazard', 'Compressed gas', 'Radioactive', 'Biohazard'],
    {
      Flammable: 'red', Corrosive: 'amber', Toxic: 'red', Oxidising: 'amber', Explosive: 'red',
      'Harmful / irritant': 'amber', 'Health hazard': 'violet', 'Environmental hazard': 'teal',
      'Compressed gas': 'blue', Radioactive: 'violet', Biohazard: 'green',
    },
    'Shown on chemicals and other hazardous items (GHS-style labels).',
  ),
  L(
    'storageGroups',
    'Storage groups',
    ['Acids', 'Bases', 'Oxidisers', 'Flammables', 'Organic', 'Toxic / poisons', 'Water-reactive', 'Inorganic salts', 'Stains & dyes', 'Preserved specimens', 'Cultures & media', 'General (no restriction)'],
    undefined,
    'Used by the storage check: groups that must not share a shelf are set under Alerts & rules.',
  ),
  L('roles', 'People roles', ['Teacher', 'Lab assistant', 'Student', 'Visitor', 'Other']),
  L('classes', 'Classes', ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12']),
  L('purposes', 'Purposes', ['Class practical', 'Demonstration', 'Project work', 'Practical exam', 'Preparation', 'Cleaning / maintenance', 'Other']),
  L('incidentTypes', 'Accident types', [
    'Cut / glass injury', 'Burn / scald', 'Chemical on skin or eyes', 'Inhaled fumes', 'Fire / flash',
    'Electric shock', 'Equipment failure', 'Slip / fall', 'Allergic reaction', 'Near miss', 'Other',
  ]),
  L('severity', 'Accident severity', ['Minor', 'Moderate', 'Serious', 'Critical'], { Minor: 'green', Moderate: 'amber', Serious: 'red', Critical: 'red' }),
  L('incidentStatus', 'Follow-up status', ['Open', 'Under review', 'Closed'], { Open: 'red', 'Under review': 'amber', Closed: 'green' }),
  L('spillSeverity', 'Spill size', ['Minor', 'Moderate', 'Major'], { Minor: 'green', Moderate: 'amber', Major: 'red' }),
  L('cleanup', 'Spill clean-up methods', ['Absorbed with spill kit', 'Neutralised', 'Wiped / mopped', 'Diluted with water', 'Swept up', 'Area evacuated and ventilated', 'Other']),
  L('breakageCause', 'Breakage causes', ['Dropped', 'Student mishap', 'Thermal shock', 'Wear and tear', 'Manufacturing defect', 'Lost / missing', 'Unknown', 'Other']),
  L('disposalReason', 'Disposal reasons', ['Expired', 'Contaminated', 'Surplus', 'Waste from experiment', 'Damaged container', 'Other']),
  L('disposalMethod', 'Disposal methods', ['Neutralised and drained', 'Collected as hazardous waste', 'Sent to authorised vendor', 'Solid waste', 'Biohazard bin / autoclave', 'Returned to supplier', 'Other']),
  L('priority', 'Priority', ['Low', 'Normal', 'Urgent'], { Low: 'gray', Normal: 'blue', Urgent: 'red' }),
  L('reqStatus', 'Requirement status', ['Requested', 'Approved', 'Ordered', 'Received', 'Rejected', 'Cancelled'], {
    Requested: 'amber', Approved: 'blue', Ordered: 'violet', Received: 'green', Rejected: 'red', Cancelled: 'gray',
  }),
  L('maintType', 'Maintenance types', ['Calibration', 'Servicing', 'Repair', 'Safety inspection', 'Cleaning', 'Testing', 'Other']),
  L('maintResult', 'Maintenance results', ['Passed / OK', 'Needs follow-up', 'Failed'], { 'Passed / OK': 'green', 'Needs follow-up': 'amber', Failed: 'red' }),
  L('condition', 'Condition', ['Good', 'Minor wear', 'Damaged', 'Missing parts'], { Good: 'green', 'Minor wear': 'amber', Damaged: 'red', 'Missing parts': 'red' }),
  L('diaryCategory', 'Diary categories', ['General', 'Safety', 'Maintenance', 'Delivery / supplier', 'Meeting', 'Reminder']),
  L('materials', 'Materials', ['Borosilicate glass', 'Soda glass', 'Plastic', 'Porcelain', 'Metal', 'Quartz', 'Rubber', 'Wood']),
  L('physicalState', 'Physical state', ['Solid', 'Liquid', 'Gas', 'Solution', 'Powder']),
  L('storageCond', 'Storage conditions', ['Room temperature', 'Cool and dry', 'Refrigerated (2–8 °C)', 'Freezer', 'Dark bottle', 'Fume hood / ventilated', 'Locked cabinet']),
  L('grades', 'Chemical grades', ['Laboratory (LR)', 'Analytical (AR)', 'Technical', 'Pharmacopoeia', 'Not stated']),
  L('preservation', 'Preservation', ['Dry', 'Formalin', 'Alcohol', 'Glycerine', 'Frozen', 'Prepared slide', 'Live']),
];

// ---------------------------------------------------------------- categories

const C = (c: Partial<Category> & Pick<Category, 'id' | 'name' | 'icon' | 'codePrefix'>): Category => ({
  labIds: [],
  kind: 'consumable',
  defaultUnit: 'pcs',
  trackExpiry: false,
  hazardous: false,
  trackService: false,
  fields: [],
  ...c,
});

const cf = (id: string, label: string, type: FieldDef['type'], extra: Partial<FieldDef> = {}): FieldDef => ({ id, label, type, ...extra });

export const DEFAULT_CATEGORIES: Category[] = [
  C({
    id: 'reagents', name: 'Chemicals & reagents', icon: 'flask', codePrefix: 'RGT', defaultUnit: 'g',
    labIds: ['chemistry', 'biology'], trackExpiry: true, hazardous: true,
    fields: [
      cf('cas', 'CAS number', 'text', { placeholder: 'e.g. 1310-73-2' }),
      cf('formula', 'Formula', 'text', { placeholder: 'e.g. NaOH' }),
      cf('state', 'Physical state', 'select', { listId: 'physicalState' }),
      cf('conc', 'Concentration', 'text', { placeholder: 'e.g. 0.1 M or 98%' }),
      cf('grade', 'Grade', 'select', { listId: 'grades' }),
      cf('storage', 'Storage conditions', 'select', { listId: 'storageCond' }),
      cf('sds', 'Safety data sheet (link)', 'url'),
    ],
  }),
  C({
    id: 'media', name: 'Culture media & stains', icon: 'dna', codePrefix: 'MED', defaultUnit: 'g',
    labIds: ['biology'], trackExpiry: true, hazardous: true,
    fields: [cf('prepared', 'Prepared / opened on', 'date'), cf('storage', 'Storage conditions', 'select', { listId: 'storageCond' })],
  }),
  C({
    id: 'glassware', name: 'Glassware & plasticware', icon: 'beaker', codePrefix: 'GLS', kind: 'asset',
    labIds: ['chemistry', 'biology', 'physics'],
    fields: [
      cf('capacity', 'Capacity / size', 'text', { placeholder: 'e.g. 250 mL' }),
      cf('material', 'Material', 'select', { listId: 'materials' }),
      cf('graduated', 'Graduated', 'checkbox'),
    ],
  }),
  C({
    id: 'instruments', name: 'Instruments & equipment', icon: 'gauge', codePrefix: 'EQP', kind: 'asset', trackService: true,
    fields: [
      cf('make', 'Make / brand', 'text'),
      cf('model', 'Model', 'text'),
      cf('serial', 'Serial number', 'text'),
      cf('range', 'Range / least count', 'text'),
      cf('power', 'Power rating', 'text', { placeholder: 'e.g. 230 V, 50 Hz' }),
      cf('warranty', 'Warranty until', 'date'),
      cf('manual', 'Manual (link)', 'url'),
    ],
  }),
  C({
    id: 'electrical', name: 'Electrical components', icon: 'zap', codePrefix: 'ELC', labIds: ['physics'],
    fields: [cf('rating', 'Rating / value', 'text', { placeholder: 'e.g. 100 Ω, 6 V' }), cf('kind', 'Type', 'text')],
  }),
  C({
    id: 'optics', name: 'Optics & magnets', icon: 'magnet', codePrefix: 'OPT', kind: 'asset', labIds: ['physics'],
    fields: [cf('focal', 'Focal length / strength', 'text'), cf('material', 'Material', 'select', { listId: 'materials' })],
  }),
  C({
    id: 'specimens', name: 'Specimens & slides', icon: 'microscope', codePrefix: 'SPC', kind: 'asset', labIds: ['biology'],
    fields: [
      cf('sci', 'Scientific name', 'text'),
      cf('preservation', 'Preservation', 'select', { listId: 'preservation' }),
      cf('preparedOn', 'Prepared on', 'date'),
      cf('source', 'Source', 'text'),
    ],
  }),
  C({ id: 'consumables', name: 'General consumables', icon: 'package', codePrefix: 'CON', defaultUnit: 'pcs', trackExpiry: true, fields: [cf('brand', 'Brand', 'text')] }),
  C({
    id: 'safety', name: 'Safety equipment', icon: 'shield', codePrefix: 'SAF', kind: 'asset', trackService: true, trackExpiry: true,
    fields: [cf('type', 'Type', 'text', { placeholder: 'e.g. fire extinguisher, eye-wash, first-aid kit' })],
  }),
  C({ id: 'models', name: 'Models, charts & kits', icon: 'book', codePrefix: 'MOD', kind: 'asset', fields: [cf('topic', 'Topic', 'text')] }),
];

// ---------------------------------------------------------------- forms (modules)

export const DEFAULT_MODULES: ModuleDef[] = [
  {
    id: 'usage', kind: 'usage', name: 'Usage log', singular: 'Usage', icon: 'clipboard', builtin: true, enabled: true, labIds: [], order: 1,
    description: 'Who used what, how much, and for which class or practical. Stock goes down automatically.',
    dateFieldId: 'date', listFieldIds: ['date', 'item', 'quantity', 'practical', 'class', 'user'],
    fields: [
      f('date', 'Date', 'date', { required: true, default: '@today', core: true }),
      f('item', 'Item used', 'item', { required: true, core: true }),
      f('quantity', 'Quantity used', 'number', { required: true, core: true }),
      f('practical', 'Experiment / practical', 'text'),
      f('purpose', 'Purpose', 'select', { listId: 'purposes' }),
      f('class', 'Class', 'select', { listId: 'classes' }),
      f('students', 'Students / groups', 'number'),
      f('user', 'Used by', 'person'),
      f('notes', 'Notes', 'textarea', { full: true }),
    ],
  },
  {
    id: 'incident', kind: 'incident', name: 'Accidents', singular: 'Accident', icon: 'siren', builtin: true, enabled: true, labIds: [], order: 2,
    description: 'Injuries, near misses and equipment failures, with first aid, cause and follow-up.',
    dateFieldId: 'when', listFieldIds: ['when', 'type', 'severity', 'involved', 'status'], statusFieldId: 'status', closedValues: ['Closed'],
    fields: [
      f('when', 'Date and time', 'datetime', { required: true, default: '@now', core: true }),
      f('type', 'Type', 'select', { listId: 'incidentTypes', required: true }),
      f('severity', 'Severity', 'select', { listId: 'severity', required: true, core: true }),
      f('involved', 'Person(s) involved', 'text', { placeholder: 'Name, class' }),
      f('description', 'What happened', 'textarea', { required: true, full: true }),
      f('firstAid', 'Immediate action / first aid', 'textarea', { full: true }),
      f('medical', 'Medical attention needed', 'checkbox'),
      f('parents', 'Parents / guardians informed', 'checkbox'),
      f('reportedTo', 'Reported to', 'text', { placeholder: 'e.g. Principal, school nurse' }),
      f('reporter', 'Reported by', 'person'),
      f('items', 'Equipment / substances involved', 'items', { full: true }),
      f('cause', 'Root cause', 'textarea', { full: true }),
      f('corrective', 'Corrective / preventive action', 'textarea', { full: true }),
      f('followUp', 'Follow-up due', 'date', { core: true }),
      f('status', 'Status', 'select', { listId: 'incidentStatus', default: 'Open', core: true }),
    ],
  },
  {
    id: 'spill', kind: 'spill', name: 'Spills', singular: 'Spill', icon: 'droplets', builtin: true, enabled: true, labIds: [], order: 3,
    description: 'Spills and leaks: what, how much, how it was cleaned up. Can take the lost amount off the stock.',
    dateFieldId: 'when', listFieldIds: ['when', 'item', 'quantity', 'severity', 'cleanup', 'status'], statusFieldId: 'status', closedValues: ['Closed'],
    fields: [
      f('when', 'Date and time', 'datetime', { required: true, default: '@now', core: true }),
      f('item', 'Substance (from inventory)', 'item', { core: true, itemKind: 'consumable' }),
      f('substance', 'Substance (if not in inventory)', 'text'),
      f('quantity', 'Amount spilled', 'number', { core: true }),
      f('deduct', 'Take it off the stock', 'checkbox', { default: true, core: true }),
      f('severity', 'Spill size', 'select', { listId: 'spillSeverity', required: true }),
      f('place', 'Where it happened', 'text'),
      f('cause', 'Cause', 'text'),
      f('cleanup', 'Clean-up method', 'select', { listId: 'cleanup' }),
      f('ppe', 'Protective equipment used', 'text', { placeholder: 'Gloves, goggles, apron...' }),
      f('exposure', 'Anyone exposed', 'checkbox'),
      f('description', 'Details', 'textarea', { full: true }),
      f('reporter', 'Reported by', 'person'),
      f('followUp', 'Follow-up due', 'date'),
      f('status', 'Status', 'select', { listId: 'incidentStatus', default: 'Open', core: true }),
    ],
  },
  {
    id: 'breakage', kind: 'breakage', name: 'Breakage & loss', singular: 'Breakage', icon: 'hammer', builtin: true, enabled: true, labIds: [], order: 4,
    description: 'Broken, damaged or missing items. Stock goes down automatically.',
    dateFieldId: 'date', listFieldIds: ['date', 'item', 'quantity', 'cause', 'who', 'replace'],
    fields: [
      f('date', 'Date', 'date', { required: true, default: '@today', core: true }),
      f('item', 'Item', 'item', { required: true, core: true }),
      f('quantity', 'Quantity', 'number', { required: true, core: true, default: 1 }),
      f('cause', 'Cause', 'select', { listId: 'breakageCause' }),
      f('who', 'Broken / lost by', 'person'),
      f('class', 'Class', 'select', { listId: 'classes' }),
      f('replace', 'Needs replacement', 'checkbox', { default: true }),
      f('cost', 'Replacement cost', 'money'),
      f('notes', 'Notes', 'textarea', { full: true }),
    ],
  },
  {
    id: 'disposal', kind: 'disposal', name: 'Disposal & waste', singular: 'Disposal', icon: 'trash', builtin: true, enabled: true, labIds: [], order: 5,
    description: 'Chemicals and materials thrown away or sent for treatment, with the reason and method. Stock goes down.',
    dateFieldId: 'date', listFieldIds: ['date', 'item', 'quantity', 'reason', 'method', 'by'],
    fields: [
      f('date', 'Date', 'date', { required: true, default: '@today', core: true }),
      f('item', 'Item disposed of', 'item', { required: true, core: true }),
      f('quantity', 'Quantity', 'number', { required: true, core: true }),
      f('reason', 'Reason', 'select', { listId: 'disposalReason' }),
      f('method', 'Method', 'select', { listId: 'disposalMethod' }),
      f('by', 'Disposed by', 'person'),
      f('notes', 'Notes', 'textarea', { full: true }),
    ],
  },
  {
    id: 'loan', kind: 'loan', name: 'Issue & return', singular: 'Loan', icon: 'swap', builtin: true, enabled: true, labIds: [], order: 6,
    description: 'Equipment lent to a teacher, student or class, and when it comes back.',
    dateFieldId: 'issued', listFieldIds: ['issued', 'item', 'quantity', 'borrower', 'group', 'due', 'returned'],
    fields: [
      f('issued', 'Issued on', 'date', { required: true, default: '@today', core: true }),
      f('item', 'Equipment', 'item', { required: true, core: true, itemKind: 'asset' }),
      f('quantity', 'Quantity', 'number', { required: true, core: true, default: 1 }),
      f('borrower', 'Issued to', 'person', { required: true, core: true }),
      f('group', 'Class / group', 'text'),
      f('purpose', 'Purpose', 'select', { listId: 'purposes' }),
      f('due', 'Due back', 'date', { required: true, core: true }),
      f('returned', 'Returned on', 'date', { core: true }),
      f('condition', 'Condition on return', 'select', { listId: 'condition' }),
      f('notes', 'Notes', 'textarea', { full: true }),
    ],
  },
  {
    id: 'requisition', kind: 'requisition', name: 'Requirements', singular: 'Requirement', icon: 'cart', builtin: true, enabled: true, labIds: [], order: 7,
    description: 'Things the lab needs: purchase requests that move from requested to received.',
    dateFieldId: 'requested', listFieldIds: ['requested', 'name', 'quantity', 'priority', 'by', 'status'], statusFieldId: 'status', closedValues: ['Received', 'Rejected', 'Cancelled'],
    fields: [
      f('requested', 'Date requested', 'date', { required: true, default: '@today', core: true }),
      f('item', 'Existing item (if any)', 'item', { core: true }),
      f('name', 'What is needed', 'text', { required: true, core: true, placeholder: 'e.g. Burette 50 mL' }),
      f('quantity', 'Quantity needed', 'number', { required: true, core: true }),
      f('unit', 'Unit', 'select', { listId: 'units', core: true }),
      f('priority', 'Priority', 'select', { listId: 'priority', default: 'Normal' }),
      f('reason', 'Why it is needed', 'text'),
      f('by', 'Requested by', 'person'),
      f('neededBy', 'Needed by', 'date'),
      f('supplier', 'Supplier', 'supplier'),
      f('estCost', 'Estimated cost', 'money'),
      f('status', 'Status', 'select', { listId: 'reqStatus', default: 'Requested', core: true }),
      f('po', 'Order / PO number', 'text'),
      f('receivedOn', 'Received on', 'date', { core: true }),
      f('notes', 'Notes', 'textarea', { full: true }),
    ],
  },
  {
    id: 'maintenance', kind: 'maintenance', name: 'Maintenance', singular: 'Maintenance', icon: 'wrench', builtin: true, enabled: true, labIds: [], order: 8,
    description: 'Calibration, servicing, repairs and safety inspections. The next-due date feeds the alerts.',
    dateFieldId: 'date', listFieldIds: ['date', 'item', 'type', 'result', 'by', 'nextDue'],
    fields: [
      f('date', 'Date done', 'date', { required: true, default: '@today', core: true }),
      f('item', 'Equipment', 'item', { required: true, core: true }),
      f('type', 'Type', 'select', { listId: 'maintType', required: true }),
      f('result', 'Result', 'select', { listId: 'maintResult' }),
      f('by', 'Done by', 'person', { placeholder: 'Person or service company' }),
      f('nextDue', 'Next due on', 'date', { core: true }),
      f('cost', 'Cost', 'money'),
      f('notes', 'Notes', 'textarea', { full: true }),
    ],
  },
  {
    id: 'session', kind: 'session', name: 'Lab sessions', singular: 'Session', icon: 'calendar', builtin: true, enabled: true, labIds: [], order: 9,
    description: 'Which class used the lab, when, and with which teacher.',
    dateFieldId: 'date', listFieldIds: ['date', 'period', 'class', 'teacher', 'topic', 'students'],
    fields: [
      f('date', 'Date', 'date', { required: true, default: '@today', core: true }),
      f('period', 'Period / time', 'text'),
      f('class', 'Class', 'select', { listId: 'classes' }),
      f('teacher', 'Teacher', 'person'),
      f('topic', 'Topic / practical', 'text'),
      f('students', 'Students present', 'number'),
      f('notes', 'Notes', 'textarea', { full: true }),
    ],
  },
  {
    id: 'diary', kind: 'diary', name: 'Lab diary', singular: 'Diary entry', icon: 'notebook', builtin: true, enabled: true, labIds: [], order: 10,
    description: 'Free-form notes: deliveries, reminders, things to remember.',
    dateFieldId: 'date', listFieldIds: ['date', 'category', 'title', 'by'],
    fields: [
      f('date', 'Date', 'date', { required: true, default: '@today', core: true }),
      f('category', 'Category', 'select', { listId: 'diaryCategory' }),
      f('title', 'Title', 'text', { required: true, core: true }),
      f('note', 'Note', 'textarea', { full: true }),
      f('by', 'Written by', 'person'),
    ],
  },
];

// ---------------------------------------------------------------- labs, settings

export const DEFAULT_LABS: Lab[] = [
  {
    id: 'physics', name: 'Physics Lab', short: 'PHY', color: '#2563eb', icon: 'atom',
    locations: ['Cupboard A', 'Cupboard B', 'Optics shelf', 'Electricity bench', 'Store room'],
  },
  {
    id: 'chemistry', name: 'Chemistry Lab', short: 'CHE', color: '#7c3aed', icon: 'flask',
    locations: ['Acid cabinet', 'Alkali shelf', 'Flammables cabinet', 'Reagent shelf 1', 'Reagent shelf 2', 'Glassware cupboard', 'Fume hood', 'Prep room'],
  },
  {
    id: 'biology', name: 'Biology Lab', short: 'BIO', color: '#059669', icon: 'leaf',
    locations: ['Fridge', 'Specimen shelf', 'Microscope cupboard', 'Slide cabinet', 'Dissection store', 'Prep room'],
  },
];

export const LAB_COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2', '#db2777', '#4f46e5', '#65a30d', '#475569'];

export const DEFAULT_SETTINGS: Settings = {
  schoolName: 'Our School',
  theme: 'system',
  textSize: 'md',
  compact: false,
  currency: '₹',
  expiryWarnDays: 60,
  serviceWarnDays: 30,
  loanDefaultDays: 7,
  allowNegativeStock: false,
  incompatible: [
    ['Acids', 'Bases'],
    ['Oxidisers', 'Flammables'],
    ['Oxidisers', 'Organic'],
    ['Acids', 'Water-reactive'],
  ],
  codeFormat: '{LAB}-{CAT}-{NNNN}',
  currentUser: '',
  itemColumns: ['code', 'name', 'category', 'quantity', 'location', 'status', 'expiry'],
};

export const SCHEMA_VERSION = 1;

export function emptyState(): AppState {
  return {
    v: SCHEMA_VERSION,
    setupDone: false,
    sample: false,
    settings: { ...DEFAULT_SETTINGS },
    labs: structuredClone(DEFAULT_LABS),
    categories: structuredClone(DEFAULT_CATEGORIES),
    lists: structuredClone(DEFAULT_LISTS),
    modules: structuredClone(DEFAULT_MODULES),
    items: [],
    txns: [],
    records: [],
    practicals: [],
    stocktakes: [],
    people: [],
    suppliers: [],
    activity: [],
  };
}

/**
 * Brings stored data up to date after an app update: adds any built-in list, module or field
 * the saved data does not have yet, without touching what the lab has customised.
 */
export function migrate(s: AppState): AppState {
  const out: AppState = { ...emptyState(), ...s };
  out.settings = { ...DEFAULT_SETTINGS, ...s.settings };
  const listIds = new Set(out.lists.map((l) => l.id));
  for (const l of DEFAULT_LISTS) if (!listIds.has(l.id)) out.lists = [...out.lists, structuredClone(l)];
  const modIds = new Map(out.modules.map((m) => [m.id, m]));
  for (const m of DEFAULT_MODULES) {
    const have = modIds.get(m.id);
    if (!have) out.modules = [...out.modules, structuredClone(m)];
    else {
      const ids = new Set(have.fields.map((x) => x.id));
      const missing = m.fields.filter((x) => !ids.has(x.id));
      if (missing.length) {
        out.modules = out.modules.map((x) => (x.id === m.id ? { ...x, fields: [...x.fields, ...structuredClone(missing)] } : x));
      }
    }
  }
  out.v = SCHEMA_VERSION;
  return out;
}
