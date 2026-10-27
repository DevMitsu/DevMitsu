import type { AppState, Borrower, DayId, Dues, LibraryId, Student } from './types';

export const LIBRARIES: Record<LibraryId, { label: string; short: string }> = {
  jr: { label: 'Jr. Library', short: 'Jr' },
  sr: { label: 'Sr. Library', short: 'Sr' },
};
export const otherLibrary = (l: LibraryId): LibraryId => (l === 'jr' ? 'sr' : 'jr');

/** Classes 1 to 5 use the Jr. Library; 6 to 12 use the Sr. Library. */
export const libraryForGrade = (grade: number): LibraryId => (grade <= 5 ? 'jr' : 'sr');
export const gradesFor = (l: LibraryId): number[] => (l === 'jr' ? [1, 2, 3, 4, 5] : [6, 7, 8, 9, 10, 11, 12]);
export const SECTIONS = ['A', 'B', 'C', 'D'];
export const classIdOf = (grade: number, section: string) => `${grade}${section}`;
export const classLabel = (id: string) => `Class ${id}`;
export const parseClassId = (id: string): { grade: number; section: string } | null => {
  const m = /^(\d{1,2})([A-Za-z])$/.exec(id.trim());
  return m ? { grade: Number(m[1]), section: m[2]!.toUpperCase() } : null;
};

/** Accession number ranges used by the library. */
export const RANGES = {
  jr: [1, 29_999],
  sr: [30_000, 49_999],
  cambridge: [150_000, 159_999],
} as const;

// ---- dates (ISO "YYYY-MM-DD", local time) ----
const pad = (n: number) => String(n).padStart(2, '0');
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromISO = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
};
export const todayISO = () => toISO(new Date());
export const addDays = (iso: string, n: number) => {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};
export const diffDays = (a: string, b: string) =>
  Math.round((fromISO(a).getTime() - fromISO(b).getTime()) / 86_400_000);
const JS_DAY: Array<DayId | null> = [null, 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export const dayOf = (iso: string): DayId | null => JS_DAY[fromISO(iso).getDay()] ?? null;
/** The given date if it is a school day (Mon-Sat), otherwise the next Monday. */
export const nextSchoolDay = (iso: string) => (dayOf(iso) ? iso : addDays(iso, 1));
export const formatDate = (iso: string, opts?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-GB', opts ?? { day: 'numeric', month: 'short', year: 'numeric' }).format(fromISO(iso));
export const formatDay = (iso: string) =>
  formatDate(iso, { weekday: 'long', day: 'numeric', month: 'long' });

// ---- dues and fines ----
export function duesFor(state: AppState, borrower: Borrower): Dues {
  if (borrower.type === 'student') return state.settings.studentDues;
  return { ...state.settings.teacherDefault, ...(state.settings.teacherOverrides[borrower.id] ?? {}) };
}
/** Days after the due date. A book due on the 15th day is not late until the 16th. */
export const lateDays = (dueOn: string, onDate: string) => Math.max(0, diffDays(onDate, dueOn));
export const fineFor = (late: number, perDay: number) => late * perDay;
export const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export const studentLibrary = (s: Student): LibraryId => libraryForGrade(s.grade);

/** Case, space and punctuation-insensitive text for searching. */
export const norm = (s: string | undefined) => (s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
