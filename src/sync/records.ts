import type { AppEvent, AppState, DayId, LibraryId, SlotException } from '../domain/types';

/** One row in the shared database. */
export interface RemoteRecord { collection: string; id: string; data: unknown }
/** A change to one row. data === null means "deleted". */
export type Change = { collection: string; id: string; data: unknown | null };
export type Snapshot = Map<string, Map<string, unknown>>;

const LIBS: LibraryId[] = ['jr', 'sr'];

/** Everything that is shared between devices, as rows. Device-only things (theme, passwords) are left out. */
export function snapshot(s: AppState): Snapshot {
  const out: Snapshot = new Map();
  const put = (c: string, id: string, v: unknown) => {
    let m = out.get(c);
    if (!m) out.set(c, (m = new Map()));
    m.set(id, v);
  };
  s.students.forEach((x) => put('students', x.id, x));
  s.teachers.forEach((x) => put('teachers', x.id, x));
  s.books.forEach((x) => put('books', x.id, x));
  s.loans.forEach((x) => put('loans', x.id, x));
  s.pending.forEach((x) => put('pending', x.id, x));
  s.fines.forEach((x) => put('fines', x.id, x));
  s.events.forEach((x) => put('events', x.id, x));
  s.challenge.entries.forEach((x) => put('entries', x.id, x));
  Object.entries(s.presence).forEach(([k, v]) => put('presence', k, v));
  for (const lib of LIBS) {
    for (const [day, periods] of Object.entries(s.timetable.regular[lib])) {
      for (const [p, ids] of Object.entries(periods)) put('ttr', `${lib}|${day}|${p}`, { classIds: ids });
    }
    for (const [date, periods] of Object.entries(s.timetable.exceptions[lib])) {
      for (const [p, exc] of Object.entries(periods)) put('tte', `${lib}|${date}|${p}`, exc);
    }
  }
  put('meta', 'settings', s.settings);
  put('meta', 'sections', s.sections);
  put('meta', 'academicYear', s.academicYear);
  put('meta', 'challengeRules', { target: s.challenge.target, minPages: s.challenge.minPages });
  put('meta', 'memory', s.memory);
  put('meta', 'names', s.names);
  return out;
}

function upsertById<T extends { id: string }>(arr: T[], changes: Change[]): T[] {
  const index = new Map(arr.map((x, i) => [x.id, i]));
  const out = arr.slice();
  const add: T[] = [];
  const del = new Set<string>();
  for (const c of changes) {
    if (c.data === null) del.add(c.id);
    else if (index.has(c.id)) out[index.get(c.id)!] = c.data as T;
    else add.push(c.data as T);
  }
  return del.size ? [...out.filter((x) => !del.has(x.id)), ...add] : [...out, ...add];
}

/** Applies changes (from the database) onto the app's state. */
export function applyChanges(state: AppState, changes: Change[]): AppState {
  if (!changes.length) return state;
  const by = new Map<string, Change[]>();
  for (const c of changes) by.set(c.collection, [...(by.get(c.collection) ?? []), c]);
  let s = state;
  const get = (c: string) => by.get(c);

  if (get('students')) s = { ...s, students: upsertById(s.students, get('students')!) };
  if (get('teachers')) s = { ...s, teachers: upsertById(s.teachers, get('teachers')!) };
  if (get('books')) s = { ...s, books: upsertById(s.books, get('books')!) };
  if (get('loans')) s = { ...s, loans: upsertById(s.loans, get('loans')!) };
  if (get('pending')) s = { ...s, pending: upsertById(s.pending, get('pending')!) };
  if (get('fines')) s = { ...s, fines: upsertById(s.fines, get('fines')!) };
  if (get('events')) {
    const merged = upsertById(s.events, get('events')!);
    s = { ...s, events: merged.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)) as AppEvent[] };
  }
  if (get('entries')) s = { ...s, challenge: { ...s.challenge, entries: upsertById(s.challenge.entries, get('entries')!) } };
  if (get('presence')) {
    const presence = { ...s.presence };
    for (const c of get('presence')!) { if (c.data === null) delete presence[c.id]; else presence[c.id] = c.data as AppState['presence'][string]; }
    s = { ...s, presence };
  }
  if (get('ttr') || get('tte')) {
    const regular = { jr: { ...s.timetable.regular.jr }, sr: { ...s.timetable.regular.sr } };
    const exceptions = { jr: { ...s.timetable.exceptions.jr }, sr: { ...s.timetable.exceptions.sr } };
    for (const c of get('ttr') ?? []) {
      const [lib, day, p] = c.id.split('|') as [LibraryId, DayId, string];
      const dayMap = { ...(regular[lib][day] ?? {}) };
      if (c.data === null) delete dayMap[p]; else dayMap[p] = (c.data as { classIds: string[] }).classIds;
      regular[lib] = { ...regular[lib], [day]: dayMap };
    }
    for (const c of get('tte') ?? []) {
      const [lib, date, p] = c.id.split('|') as [LibraryId, string, string];
      const dateMap = { ...(exceptions[lib][date] ?? {}) };
      if (c.data === null) delete dateMap[p]; else dateMap[p] = c.data as SlotException;
      const libMap = { ...exceptions[lib] };
      if (Object.keys(dateMap).length) libMap[date] = dateMap; else delete libMap[date];
      exceptions[lib] = libMap;
    }
    s = { ...s, timetable: { regular, exceptions } };
  }
  for (const c of get('meta') ?? []) {
    if (c.data === null) continue;
    if (c.id === 'settings') s = { ...s, settings: c.data as AppState['settings'] };
    else if (c.id === 'sections') s = { ...s, sections: c.data as AppState['sections'] };
    else if (c.id === 'academicYear') s = { ...s, academicYear: c.data as AppState['academicYear'] };
    else if (c.id === 'challengeRules') s = { ...s, challenge: { ...s.challenge, ...(c.data as { target: number; minPages: number }) } };
    else if (c.id === 'memory') s = { ...s, memory: c.data as AppState['memory'] };
    else if (c.id === 'names') s = { ...s, names: c.data as AppState['names'] };
  }
  return s;
}

/** Same text for the same data, whatever order the keys came in. Used to tell whether two rows are really different. */
export function canon(v: unknown): string {
  return JSON.stringify(v, (_k, val) => (val && typeof val === 'object' && !Array.isArray(val)
    ? Object.fromEntries(Object.entries(val as Record<string, unknown>).filter(([, x]) => x !== undefined).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
    : val));
}
