// The whole data model. Everything a lab can customise (labs, categories, fields, lists, forms)
// is DATA in this model, not code, so the Customise screens can change all of it.

export type ID = string;
export type Value = string | number | boolean | string[] | null | undefined;
export type Values = Record<string, Value>;

export type Tone = 'gray' | 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'teal';

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'money'
  | 'date'
  | 'datetime'
  | 'select'
  | 'multiselect'
  | 'checkbox'
  | 'url'
  | 'item' // one inventory item (stores the item id)
  | 'items' // several inventory items (stores ids)
  | 'person' // a name, suggested from the People directory (free text allowed)
  | 'supplier'; // a name, suggested from the Suppliers directory

export interface FieldDef {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  help?: string;
  placeholder?: string;
  unit?: string; // suffix shown on number fields
  listId?: string; // select / multiselect: use a shared list
  options?: string[]; // select / multiselect: or the field's own options
  /** A literal default, or '@today' / '@now' for date / datetime fields. */
  default?: Value;
  /** For item fields: only offer assets (equipment) or only consumables. */
  itemKind?: 'asset' | 'consumable';
  /** Built into the app: cannot be deleted. */
  builtin?: boolean;
  /** Built-in field that the app's logic depends on: cannot be hidden or have its type changed. */
  core?: boolean;
  hidden?: boolean;
  full?: boolean; // always spans the full form width
}

export interface ListDef {
  id: string;
  name: string;
  description?: string;
  options: string[];
  tones?: Record<string, Tone>;
  builtin?: boolean;
}

export interface Lab {
  id: ID;
  name: string;
  short: string; // used in item codes, e.g. PHY
  color: string; // hex
  icon: string; // key into the icon set
  room?: string;
  incharge?: string;
  notes?: string;
  locations: string[]; // cupboards, shelves, fridges, benches...
  archived?: boolean;
}

export interface Category {
  id: ID;
  name: string;
  icon: string;
  /** Labs this category applies to. Empty = every lab. */
  labIds: ID[];
  /** consumable: quantity goes down as it is used. asset: equipment that is lent out and returned. */
  kind: 'consumable' | 'asset';
  codePrefix: string;
  defaultUnit: string;
  trackExpiry: boolean; // expiry date + lot / batch
  hazardous: boolean; // hazard labels + storage group
  trackService: boolean; // calibration / servicing schedule
  fields: FieldDef[]; // this category's own extra fields
  archived?: boolean;
}

export interface Item {
  id: ID;
  labId: ID;
  categoryId: ID;
  name: string;
  code: string;
  description?: string;
  quantity: number;
  unit: string;
  minStock?: number; // reorder level: alert when quantity is at or below this
  targetStock?: number; // "fill up to" level, used to suggest how much to order
  location?: string;
  supplier?: string;
  unitCost?: number;
  purchaseDate?: string;
  status: string;
  lot?: string;
  expiry?: string;
  hazards?: string[];
  storageGroup?: string;
  serviceEveryDays?: number;
  lastServiced?: string;
  nextServiceDue?: string;
  custom: Values;
  tags?: string[];
  notes?: string;
  archived?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TxnType =
  | 'opening'
  | 'receive'
  | 'use'
  | 'spill'
  | 'breakage'
  | 'dispose'
  | 'adjust'
  | 'stocktake'
  | 'transfer-out'
  | 'transfer-in'
  | 'correction';

export interface StockTxn {
  id: ID;
  itemId: ID;
  labId: ID;
  at: string; // ISO timestamp
  type: TxnType;
  delta: number;
  balance: number;
  note?: string;
  recordId?: ID; // the usage / spill / ... record this came from
  by?: string;
}

export type ModuleKind =
  | 'usage'
  | 'incident'
  | 'spill'
  | 'breakage'
  | 'disposal'
  | 'loan'
  | 'requisition'
  | 'maintenance'
  | 'session'
  | 'diary'
  | 'custom';

export interface ModuleDef {
  id: string;
  kind: ModuleKind;
  name: string; // sidebar label, e.g. "Accidents"
  singular: string; // "Accident"
  icon: string;
  description?: string;
  builtin: boolean;
  enabled: boolean;
  labIds: ID[]; // empty = every lab
  fields: FieldDef[];
  dateFieldId: string;
  listFieldIds: string[]; // columns, in order
  statusFieldId?: string;
  closedValues?: string[]; // status values meaning "finished" (not an open item)
  order: number;
}

export interface LabRecord {
  id: ID;
  moduleId: string;
  labId: ID;
  values: Values;
  createdAt: string;
  updatedAt: string;
  by?: string;
}

export interface Person {
  id: ID;
  name: string;
  role: string;
  group?: string; // class or department
  phone?: string;
  email?: string;
  notes?: string;
  active: boolean;
}

export interface Supplier {
  id: ID;
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  notes?: string;
}

export interface PracticalMaterial {
  itemId?: ID;
  name: string; // shown when there is no linked item
  qtyPerGroup: number;
  unit?: string;
  note?: string;
}

export interface Practical {
  id: ID;
  labId: ID;
  name: string;
  level?: string; // class or grade
  durationMin?: number;
  description?: string;
  safety?: string;
  materials: PracticalMaterial[];
  archived?: boolean;
  createdAt: string;
}

export interface StocktakeLine {
  itemId: ID;
  expected: number;
  counted: number;
}

export interface Stocktake {
  id: ID;
  labId: ID;
  at: string;
  by?: string;
  scope: string;
  lines: StocktakeLine[];
  notes?: string;
}

export interface Activity {
  id: ID;
  at: string;
  by?: string;
  labId?: ID;
  text: string;
}

export interface Settings {
  schoolName: string;
  theme: 'light' | 'dark' | 'system';
  textSize: 'sm' | 'md' | 'lg';
  compact: boolean;
  currency: string;
  expiryWarnDays: number;
  serviceWarnDays: number;
  loanDefaultDays: number;
  allowNegativeStock: boolean;
  /** Suggested fine for a breakage, as a percentage of the item's cost. */
  finePercent: number;
  /** Warn about a fine that is still unpaid after this many days. */
  fineUnpaidDays: number;
  /** Pairs of storage groups that must not share a location. */
  incompatible: [string, string][];
  /** Item code pattern. Tokens: {LAB} {CAT} {NNNN} */
  codeFormat: string;
  currentUser: string; // "Working as": stamped on everything entered
  lastBackupAt?: string;
  itemColumns: string[]; // visible columns in the inventory table
}

export interface AppState {
  v: number;
  setupDone: boolean;
  sample: boolean; // the data was loaded from the demo set
  settings: Settings;
  labs: Lab[];
  categories: Category[];
  lists: ListDef[];
  modules: ModuleDef[];
  items: Item[];
  txns: StockTxn[];
  records: LabRecord[];
  practicals: Practical[];
  stocktakes: Stocktake[];
  people: Person[];
  suppliers: Supplier[];
  activity: Activity[];
}
