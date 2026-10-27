import { dayOf, libraryForGrade, norm } from './rules';
import type {
  AppState, Book, Borrower, Collection, LibraryId, Loan, SlotException, Student, Teacher,
} from './types';
import { RANGES } from './rules';

export const studentById = (s: AppState, id: string) => s.students.find((x) => x.id === id);
export const teacherById = (s: AppState, id: string) => s.teachers.find((x) => x.id === id);
export const bookById = (s: AppState, id: string) => s.books.find((x) => x.id === id);

export function borrowerOf(s: AppState, b: Borrower): Student | Teacher | undefined {
  return b.type === 'student' ? studentById(s, b.id) : teacherById(s, b.id);
}
export function borrowerName(s: AppState, b: Borrower): string {
  return borrowerOf(s, b)?.name ?? 'Unknown';
}
export function borrowerSub(s: AppState, b: Borrower): string {
  if (b.type === 'student') {
    const st = studentById(s, b.id);
    return st ? `Class ${st.grade}${st.section} · ${st.grNo}` : '';
  }
  const t = teacherById(s, b.id);
  return t ? `Teacher · ${t.department}` : '';
}
export const borrowerPath = (b: Borrower) => (b.type === 'student' ? `/student/${b.id}` : `/teacher/${b.id}`);

export function openLoansOf(s: AppState, b: Borrower): Loan[] {
  return s.loans.filter((l) => !l.returnedOn && l.borrowerType === b.type && l.borrowerId === b.id);
}
export function studentsOfClass(s: AppState, classId: string): Student[] {
  return s.students
    .filter((x) => x.active && `${x.grade}${x.section}` === classId)
    .sort((a, b) => a.name.localeCompare(b.name));
}
export function unresolvedPending(s: AppState) {
  return s.pending.filter((p) => !p.resolvedOn);
}
export function pendingOf(s: AppState, b: Borrower) {
  return unresolvedPending(s).filter((p) => p.borrowerType === b.type && p.borrowerId === b.id);
}
export const fineOwed = (f: { amount: number; waived: number; collected: number }) => f.amount - f.waived - f.collected;

export function nextAccession(s: AppState, library: LibraryId, collection: Collection): number {
  const [lo, hi] = collection === 'cambridge' ? RANGES.cambridge : RANGES[library];
  const used = s.books.filter((b) => b.accession >= lo && b.accession <= hi).map((b) => b.accession);
  return used.length ? Math.max(...used) + 1 : lo;
}

/** Books for one accession number (there can be several: the real list has shared numbers). */
export const booksByAccession = (s: AppState, n: number) => s.books.filter((b) => b.accession === n);

export function searchBooks(s: AppState, q: string, limit = 8): Book[] {
  const query = q.trim();
  if (!query) return [];
  if (/^\d+$/.test(query)) {
    const n = Number(query);
    const exact = booksByAccession(s, n);
    const partial = s.books.filter((b) => b.accession !== n && String(b.accession).startsWith(query));
    return [...exact, ...partial].slice(0, limit);
  }
  const words = norm(query).split(' ');
  return s.books
    .filter((b) => {
      const hay = norm(`${b.title} ${b.author ?? ''}`);
      return words.every((w) => hay.includes(w));
    })
    .slice(0, limit);
}

// ---- timetable ----
export interface EffectiveSlot {
  classIds: string[];
  regular: string[];
  source: 'regular' | 'proxy' | 'added' | 'cancelled' | 'none';
  exception?: SlotException;
}
export function effectiveSlot(s: AppState, library: LibraryId, date: string, periodId: string): EffectiveSlot {
  const day = dayOf(date);
  const regular = (day && s.timetable.regular[library][day]?.[periodId]) || [];
  const exception = s.timetable.exceptions[library][date]?.[periodId];
  if (exception) {
    if (exception.kind === 'cancel') return { classIds: [], regular, source: 'cancelled', exception };
    return { classIds: exception.classIds, regular, source: exception.kind === 'add' ? 'added' : 'proxy', exception };
  }
  return { classIds: regular, regular, source: regular.length ? 'regular' : 'none' };
}

/** Which lecture (if any) is this class booked in on this date? */
export function slotForClass(s: AppState, library: LibraryId, date: string, classId: string, periodIds: string[]) {
  return periodIds.find((id) => effectiveSlot(s, library, date, id).classIds.includes(classId));
}

export const presenceKey = (date: string, classId: string, slot: string) => `${date}|${classId}|${slot}`;

export const libraryOfClassId = (classId: string): LibraryId | null => {
  const m = /^(\d+)/.exec(classId);
  return m ? libraryForGrade(Number(m[1])) : null;
};
