import { buildSeed } from '../data/seed';
import { addDays, duesFor, fineFor, lateDays, libraryForGrade, todayISO } from '../domain/rules';
import {
  bookById, borrowerOf, fineOwed, openLoansOf, studentById,
} from '../domain/queries';
import type {
  AppEvent, AppState, Book, BookStatus, Borrower, Collection, DayId, Fine, LibraryId, Loan, LostOutcome,
  NoteCategory, Pending, Presence, SlotException, Student,
} from '../domain/types';
import { getState, replaceState, setState, setUndo } from './store';

let counter = Date.now() % 100000;
const uid = (p: string) => `${p}${(++counter).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export interface Result {
  ok: boolean;
  errors: string[];
  message?: string;
}
const fail = (...errors: string[]): Result => ({ ok: false, errors });
const done = (message?: string): Result => ({ ok: true, errors: [], message });

// ---------- profile and library ----------
export function checkPassword(lib: LibraryId, password: string) {
  return getState().passwords[lib] === password;
}
export function switchLibrary(lib: LibraryId) {
  setState((s) => ({ ...s, activeLibrary: lib }));
}
export function setLibrarianName(lib: LibraryId, name: string) {
  setState((s) => ({ ...s, names: { ...s.names, [lib]: name.trim() || 'Librarian' } }));
}
export function changePassword(lib: LibraryId, oldPw: string, newPw: string, confirm: string): Result {
  if (!checkPassword(lib, oldPw)) return fail('The old password is not correct.');
  if (newPw.length < 4) return fail('Use at least 4 characters for the new password.');
  if (newPw !== confirm) return fail('The new password and its confirmation do not match.');
  if (newPw === oldPw) return fail('Choose a password different from the old one.');
  setState((s) => ({ ...s, passwords: { ...s.passwords, [lib]: newPw } }));
  return done('Password changed.');
}

// ---------- people ----------
const nextGr = (s: AppState) => {
  const nums = s.students.map((x) => Number(/\d+/.exec(x.grNo)?.[0] ?? 0));
  return `GR${Math.max(1000, ...nums) + 1}`;
};
export function addStudent(input: { name: string; grade: number; section: string; grNo?: string }): Result {
  const s = getState();
  const name = input.name.trim();
  if (!name) return fail('Enter the student’s name.');
  const grNo = input.grNo?.trim() || nextGr(s);
  if (s.students.some((x) => x.grNo.toLowerCase() === grNo.toLowerCase())) return fail(`GR no. ${grNo} already belongs to another student.`);
  const student: Student = { id: uid('s'), grNo, name, grade: input.grade, section: input.section.toUpperCase(), active: true };
  setState((st) => ({ ...st, students: [...st.students, student] }));
  return done(`${name} added to Class ${student.grade}${student.section}.`);
}
export function bulkAddStudents(rows: Array<{ name: string; grade: number; section: string; grNo?: string }>): Result {
  let added = 0;
  const errors: string[] = [];
  rows.forEach((r, i) => {
    const res = addStudent(r);
    if (res.ok) added++;
    else errors.push(`Line ${i + 1}: ${res.errors[0]}`);
  });
  return errors.length ? { ok: added > 0, errors, message: `${added} added.` } : done(`${added} students added.`);
}
export function updateStudent(id: string, patch: Partial<Pick<Student, 'name' | 'grNo' | 'grade' | 'section' | 'active'>>): Result {
  const s = getState();
  if (patch.grNo && s.students.some((x) => x.id !== id && x.grNo.toLowerCase() === patch.grNo!.toLowerCase())) {
    return fail(`GR no. ${patch.grNo} already belongs to another student.`);
  }
  if (patch.name !== undefined && !patch.name.trim()) return fail('Enter the student’s name.');
  setState((st) => ({ ...st, students: st.students.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  return done('Saved.');
}
export function moveStudentSection(id: string, section: string): Result {
  const s = getState();
  const st = studentById(s, id);
  if (!st) return fail('Student not found.');
  if (st.section === section) return fail('The student is already in that section.');
  const ev: AppEvent = {
    id: uid('e'), date: todayISO(), type: 'student_moved', library: libraryForGrade(st.grade),
    detail: `${st.name} (${st.grNo}): ${st.grade}${st.section} → ${st.grade}${section}`,
  };
  setState((x) => ({
    ...x,
    students: x.students.map((k) => (k.id === id ? { ...k, section } : k)),
    events: [ev, ...x.events],
  }));
  return done(`${st.name} moved from ${st.grade}${st.section} to ${st.grade}${section}.`);
}
/** Year-end: everyone moves up one class; class 12 students leave. */
export function promoteAll(): Result {
  const s = getState();
  const active = s.students.filter((x) => x.active);
  const left = active.filter((x) => x.grade === 12).length;
  const ev: AppEvent = { id: uid('e'), date: todayISO(), type: 'promotion', detail: `${active.length} students moved up; ${left} left from class 12` };
  setState((x) => ({
    ...x,
    students: x.students.map((k) => (!k.active ? k : k.grade === 12 ? { ...k, active: false } : { ...k, grade: k.grade + 1 })),
    events: [ev, ...x.events],
  }));
  return done(`${active.length - left} students moved up and ${left} left school.`);
}
export function addTeacher(input: { name: string; department: string }): Result {
  const name = input.name.trim();
  if (!name) return fail('Enter the teacher’s name.');
  setState((x) => ({ ...x, teachers: [...x.teachers, { id: uid('t'), name, department: input.department.trim() || '—', active: true }] }));
  return done(`${name} added.`);
}
export function updateTeacher(id: string, patch: { name?: string; department?: string; active?: boolean }): Result {
  if (patch.name !== undefined && !patch.name.trim()) return fail('Enter the teacher’s name.');
  setState((x) => ({ ...x, teachers: x.teachers.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  return done('Saved.');
}

// ---------- presence ----------
export function setPresence(key: string, studentId: string, value: Presence | null) {
  setState((s) => {
    const rec = { ...(s.presence[key] ?? {}) };
    if (value) rec[studentId] = value;
    else delete rec[studentId];
    return { ...s, presence: { ...s.presence, [key]: rec } };
  });
}
export function markAllPresent(key: string, studentIds: string[]) {
  setState((s) => ({ ...s, presence: { ...s.presence, [key]: Object.fromEntries(studentIds.map((id) => [id, 'present' as Presence])) } }));
}
export function clearPresence(key: string) {
  setState((s) => {
    const presence = { ...s.presence };
    delete presence[key];
    return { ...s, presence };
  });
}

// ---------- timetable ----------
export function setRegular(library: LibraryId, day: DayId, periodId: string, classIds: string[]) {
  setState((s) => {
    const dayMap = { ...s.timetable.regular[library][day] };
    if (classIds.length) dayMap[periodId] = classIds;
    else delete dayMap[periodId];
    return { ...s, timetable: { ...s.timetable, regular: { ...s.timetable.regular, [library]: { ...s.timetable.regular[library], [day]: dayMap } } } };
  });
}
export function setException(library: LibraryId, date: string, periodId: string, exception: SlotException | null) {
  setState((s) => {
    const dateMap = { ...(s.timetable.exceptions[library][date] ?? {}) };
    if (exception) dateMap[periodId] = exception;
    else delete dateMap[periodId];
    const lib = { ...s.timetable.exceptions[library] };
    if (Object.keys(dateMap).length) lib[date] = dateMap;
    else delete lib[date];
    return { ...s, timetable: { ...s.timetable, exceptions: { ...s.timetable.exceptions, [library]: lib } } };
  });
}

// ---------- circulation ----------
/** Reason a book cannot be issued to this borrower, or null. */
export function issueBlock(_s: AppState, borrower: Borrower, book: Book): string | null {
  if (book.status === 'Issued') return 'Already issued to someone';
  if (book.status !== 'Available') return `Marked ${book.status.toLowerCase()}`;
  if (book.collection === 'cambridge' && borrower.type === 'student') return 'Cambridge books are for teachers only';
  return null;
}
export const isCrossLibrary = (s: AppState, borrower: Borrower, book: Book) => {
  if (borrower.type !== 'student') return false;
  const st = studentById(s, borrower.id);
  return !!st && libraryForGrade(st.grade) !== book.library;
};

export interface TxnInput {
  borrower: Borrower;
  returns: {
    loanIds: string[];
    parked: boolean;
    lost: Record<string, { outcome: LostOutcome; note: string }>;
    fines: Record<string, { waive: number; note: string; settle: 'collected' | 'owed' }>;
  };
  issue: { bookIds: string[]; parked: boolean; parkedText: string; crossNote: string };
  resolvePendingIds: string[];
}

export function lateFineFor(s: AppState, borrower: Borrower, loan: Loan, onDate = todayISO()) {
  const late = lateDays(loan.dueOn, onDate);
  return { late, amount: fineFor(late, duesFor(s, borrower).finePerDay) };
}

export function processTransaction(input: TxnInput): Result {
  const s0 = getState();
  const today = todayISO();
  const { borrower, returns, issue } = input;
  const errors: string[] = [];
  const nothing = !returns.loanIds.length && !issue.bookIds.length && !issue.parked;
  if (nothing) return fail('Nothing to confirm yet. Tick a book to return or add a book to issue.');
  if (returns.parked && !returns.loanIds.length) return fail('Tick the books that were not submitted.');

  const loans = returns.loanIds.map((id) => s0.loans.find((l) => l.id === id)).filter((l): l is Loan => !!l && !l.returnedOn);
  const books = issue.bookIds.map((id) => bookById(s0, id)).filter((b): b is Book => !!b);

  if (!returns.parked) {
    loans.forEach((l) => {
      const lost = returns.lost[l.id];
      const { amount } = lateFineFor(s0, borrower, l);
      const dec = returns.fines[l.id];
      if (!lost && amount > 0 && dec && dec.waive > 0 && !dec.note.trim()) {
        errors.push(`Add a note for the fine waived on “${bookById(s0, l.bookId)?.title}”.`);
      }
      if (!lost && amount > 0 && dec && (dec.waive < 0 || dec.waive > amount)) errors.push(`The waived amount must be between ₹0 and ₹${amount}.`);
      if (lost && !lost.note.trim()) errors.push(`Add a note for the lost book “${bookById(s0, l.bookId)?.title}”.`);
    });
  }
  if (!issue.parked) {
    const returningNow = returns.parked ? 0 : loans.length;
    const dues = duesFor(s0, borrower);
    const held = openLoansOf(s0, borrower).length - returningNow;
    if (books.length && held + books.length > dues.maxBooks) {
      errors.push(`Limit is ${dues.maxBooks} books at a time. This borrower would hold ${held + books.length}.`);
    }
    books.forEach((b) => {
      const reason = issueBlock(s0, borrower, b);
      if (reason) errors.push(`#${b.accession} ${b.title}: ${reason}.`);
      if (isCrossLibrary(s0, borrower, b) && !issue.crossNote.trim()) errors.push('Add a note for the cross-library issue.');
    });
    if (new Set(issue.bookIds).size !== issue.bookIds.length) errors.push('The same book was added twice.');
  }
  if (errors.length) return { ok: false, errors: [...new Set(errors)] };

  setUndo({ label: 'Last transaction', slices: { books: s0.books, loans: s0.loans, pending: s0.pending, fines: s0.fines, events: s0.events } });

  let booksNext = s0.books;
  let loansNext = s0.loans;
  const pendingNext: Pending[] = [...s0.pending];
  const finesNext: Fine[] = [...s0.fines];
  const eventsNext: AppEvent[] = [...s0.events];
  const parts: string[] = [];

  if (returns.parked) {
    pendingNext.push({ id: uid('p'), kind: 'return', borrowerType: borrower.type, borrowerId: borrower.id, loanIds: loans.map((l) => l.id), text: '', createdOn: today });
    parts.push(`${loans.length} return${loans.length > 1 ? 's' : ''} saved to Pending`);
  } else if (loans.length) {
    let fineTotal = 0;
    let returned = 0;
    loans.forEach((l) => {
      const lost = returns.lost[l.id];
      const book = bookById(s0, l.bookId)!;
      if (lost) {
        loansNext = loansNext.map((x) => (x.id === l.id ? { ...x, returnedOn: today, lost } : x));
        booksNext = booksNext.map((b) => (b.id === l.bookId ? { ...b, status: 'Lost' as BookStatus } : b));
        eventsNext.unshift({ id: uid('e'), date: today, type: 'removed', library: book.library, accession: book.accession, title: book.title, detail: 'Lost', note: `Lost (${lost.outcome}): ${lost.note}` });
        return;
      }
      returned++;
      loansNext = loansNext.map((x) => (x.id === l.id ? { ...x, returnedOn: today } : x));
      booksNext = booksNext.map((b) => (b.id === l.bookId ? { ...b, status: 'Available' as BookStatus } : b));
      const { amount } = lateFineFor(s0, borrower, l);
      if (amount > 0) {
        const dec = returns.fines[l.id] ?? { waive: 0, note: '', settle: 'collected' as const };
        const payable = amount - dec.waive;
        finesNext.push({
          id: uid('f'), loanId: l.id, borrowerType: borrower.type, borrowerId: borrower.id, bookId: l.bookId, createdOn: today,
          amount, waived: dec.waive, collected: dec.settle === 'collected' ? payable : 0, waiveNote: dec.waive > 0 ? dec.note.trim() : undefined,
        });
        fineTotal += dec.settle === 'collected' ? payable : 0;
      }
    });
    const lostCount = loans.length - returned;
    parts.push(`${returned} returned${lostCount ? `, ${lostCount} marked lost` : ''}${fineTotal ? `, ₹${fineTotal} fine collected` : ''}`);
    // a return completes any pending "return not submitted" for these loans
    for (let i = 0; i < pendingNext.length; i++) {
      const p = pendingNext[i]!;
      if (p.kind === 'return' && !p.resolvedOn && p.loanIds.length && p.loanIds.every((id) => loansNext.find((x) => x.id === id)?.returnedOn)) {
        pendingNext[i] = { ...p, resolvedOn: today, resolvedNote: 'Returned' };
      }
    }
  }

  if (issue.parked) {
    pendingNext.push({ id: uid('p'), kind: 'issue', borrowerType: borrower.type, borrowerId: borrower.id, loanIds: [], text: issue.parkedText.trim() || 'Books to be entered', createdOn: today });
    parts.push('1 issue saved to Pending');
  } else if (books.length) {
    const dues = duesFor(s0, borrower);
    books.forEach((b) => {
      const cross = isCrossLibrary(s0, borrower, b);
      loansNext = [...loansNext, {
        id: uid('l'), borrowerType: borrower.type, borrowerId: borrower.id, bookId: b.id, issuedOn: today,
        dueOn: addDays(today, dues.loanDays), crossNote: cross ? issue.crossNote.trim() : undefined,
      }];
      booksNext = booksNext.map((x) => (x.id === b.id ? { ...x, status: 'Issued' as BookStatus } : x));
    });
    parts.push(`${books.length} issued, due ${addDays(today, dues.loanDays)}`);
  }

  // explicit pending ids (e.g. "issue to update") are resolved when real work replaced them
  const resolved = new Set(input.resolvePendingIds);
  for (let i = 0; i < pendingNext.length; i++) {
    const p = pendingNext[i]!;
    if (resolved.has(p.id) && !p.resolvedOn && ((p.kind === 'issue' && books.length && !issue.parked) || (p.kind === 'return' && !returns.parked))) {
      pendingNext[i] = { ...p, resolvedOn: today, resolvedNote: p.kind === 'issue' ? 'Details entered' : 'Returned' };
    }
  }

  setState((s) => ({ ...s, books: booksNext, loans: loansNext, pending: pendingNext, fines: finesNext, events: eventsNext }));
  return done(parts.join('. ') + '.');
}

export function undoLast(snapshot: { slices: Pick<AppState, 'books' | 'loans' | 'pending' | 'fines' | 'events'> }) {
  setState((s) => ({ ...s, ...snapshot.slices }));
  setUndo(null);
}

export function renewLoan(loanId: string): Result {
  const s = getState();
  const loan = s.loans.find((l) => l.id === loanId);
  if (!loan || loan.returnedOn) return fail('This loan is already closed.');
  if (lateDays(loan.dueOn, todayISO()) > 0) return fail('This book is overdue. Return it first so the fine can be settled.');
  const dues = duesFor(s, { type: loan.borrowerType, id: loan.borrowerId });
  const dueOn = addDays(todayISO(), dues.loanDays);
  setState((x) => ({ ...x, loans: x.loans.map((l) => (l.id === loanId ? { ...l, dueOn, renewals: (l.renewals ?? 0) + 1 } : l)) }));
  return done(`Renewed. New due date ${dueOn}.`);
}

// ---------- pending and fines ----------
export function closePending(id: string, note: string): Result {
  if (!note.trim()) return fail('Add a note explaining why this is being closed.');
  setState((s) => ({ ...s, pending: s.pending.map((p) => (p.id === id ? { ...p, resolvedOn: todayISO(), resolvedNote: note.trim() } : p)) }));
  return done('Closed.');
}
export function collectFine(id: string): Result {
  const f = getState().fines.find((x) => x.id === id);
  if (!f) return fail('Fine not found.');
  setState((s) => ({ ...s, fines: s.fines.map((x) => (x.id === id ? { ...x, collected: x.amount - x.waived } : x)) }));
  return done(`₹${fineOwed(f)} collected.`);
}
export function waiveFine(id: string, amount: number, note: string): Result {
  const f = getState().fines.find((x) => x.id === id);
  if (!f) return fail('Fine not found.');
  if (!(amount > 0) || amount > fineOwed(f)) return fail(`Enter an amount between ₹1 and ₹${fineOwed(f)}.`);
  if (!note.trim()) return fail('A note is required to waive a fine.');
  setState((s) => ({ ...s, fines: s.fines.map((x) => (x.id === id ? { ...x, waived: x.waived + amount, waiveNote: [x.waiveNote, note.trim()].filter(Boolean).join('; ') } : x)) }));
  return done(`₹${amount} waived.`);
}

// ---------- collection ----------
export const isDF = (type: string) => type.trim().toUpperCase() === 'DF';
/** An accession number is unique within a series: Daily Five (DF) books may share a number with a regular book. */
export const accessionClash = (books: Book[], accession: number, type: string) =>
  books.find((b) => b.accession === accession && isDF(b.type) === isDF(type));
export function addBook(input: {
  title: string; author?: string; type: string; library: LibraryId; collection: Collection; accession: number; note: string; kind: 'new' | 'import';
}): Result {
  const s = getState();
  if (!input.title.trim()) return fail('Enter the book’s title.');
  if (!Number.isInteger(input.accession) || input.accession <= 0) return fail('Enter a valid accession number.');
  const clash = accessionClash(s.books, input.accession, input.type);
  if (clash) return fail(`Accession ${input.accession} is already used by “${clash.title}”. Choose another number.`);
  if (!input.note.trim()) return fail('Choose or type a note for this entry.');
  const book: Book = {
    id: uid('b'), accession: input.accession, title: input.title.trim(), author: input.author?.trim() || undefined,
    type: input.type.trim() || 'FICTION', library: input.library, collection: input.collection, status: 'Available',
  };
  const ev: AppEvent = { id: uid('e'), date: todayISO(), type: input.kind === 'import' ? 'import' : 'added', library: book.library, accession: book.accession, title: book.title, note: input.note.trim() };
  setState((x) => ({ ...x, books: [...x.books, book], events: [ev, ...x.events] }));
  return done(`Added #${book.accession} ${book.title}.`);
}
function blockIssued(books: Book[]): string[] {
  return books.filter((b) => b.status === 'Issued').map((b) => `#${b.accession} ${b.title} is currently issued.`);
}
export function removeBooks(input: { bookIds: string[]; status: 'Lost' | 'Damaged' | 'Discarded'; note: string }): Result {
  const s = getState();
  const books = input.bookIds.map((id) => bookById(s, id)).filter((b): b is Book => !!b);
  if (!books.length) return fail('Add at least one book.');
  const errs = blockIssued(books);
  if (errs.length) return { ok: false, errors: errs };
  if (!input.note.trim()) return fail('Choose or type a note for this removal.');
  const evs: AppEvent[] = books.map((b) => ({ id: uid('e'), date: todayISO(), type: 'removed', library: b.library, accession: b.accession, title: b.title, detail: input.status, note: input.note.trim() }));
  const ids = new Set(books.map((b) => b.id));
  setState((x) => ({ ...x, books: x.books.map((b) => (ids.has(b.id) ? { ...b, status: input.status } : b)), events: [...evs, ...x.events] }));
  return done(`${books.length} book${books.length > 1 ? 's' : ''} marked ${input.status.toLowerCase()}.`);
}
export function exportBooks(input: { bookIds: string[]; note: string }): Result {
  const s = getState();
  const books = input.bookIds.map((id) => bookById(s, id)).filter((b): b is Book => !!b);
  if (!books.length) return fail('Add at least one book.');
  const errs = blockIssued(books);
  if (errs.length) return { ok: false, errors: errs };
  if (!input.note.trim()) return fail('Choose or type a note for this export.');
  const evs: AppEvent[] = books.map((b) => ({ id: uid('e'), date: todayISO(), type: 'export', library: b.library, accession: b.accession, title: b.title, note: input.note.trim() }));
  const ids = new Set(books.map((b) => b.id));
  setState((x) => ({ ...x, books: x.books.map((b) => (ids.has(b.id) ? { ...b, status: 'Out of school' as BookStatus } : b)), events: [...evs, ...x.events] }));
  return done(`${books.length} book${books.length > 1 ? 's' : ''} exported.`);
}
export function transferBooks(input: { bookIds: string[]; to: LibraryId; note: string }): Result {
  const s = getState();
  const books = input.bookIds.map((id) => bookById(s, id)).filter((b): b is Book => !!b);
  if (!books.length) return fail('Add at least one book.');
  const errs = blockIssued(books);
  if (books.some((b) => b.library === input.to)) errs.push('Some books are already in the destination library.');
  if (errs.length) return { ok: false, errors: errs };
  if (!input.note.trim()) return fail('Choose or type a note for this transfer.');
  const evs: AppEvent[] = books.map((b) => ({ id: uid('e'), date: todayISO(), type: 'transfer', from: b.library, to: input.to, accession: b.accession, title: b.title, note: input.note.trim() }));
  const ids = new Set(books.map((b) => b.id));
  setState((x) => ({ ...x, books: x.books.map((b) => (ids.has(b.id) ? { ...b, library: input.to, transferredFrom: b.library } : b)), events: [...evs, ...x.events] }));
  return done(`${books.length} book${books.length > 1 ? 's' : ''} transferred.`);
}

// ---------- settings ----------
export function setStudentDues(patch: Partial<AppState['settings']['studentDues']>) {
  setState((s) => ({ ...s, settings: { ...s.settings, studentDues: { ...s.settings.studentDues, ...patch } } }));
}
export function setTeacherDefault(patch: Partial<AppState['settings']['teacherDefault']>) {
  setState((s) => ({ ...s, settings: { ...s.settings, teacherDefault: { ...s.settings.teacherDefault, ...patch } } }));
}
export function setTeacherOverride(id: string, patch: Partial<AppState['settings']['teacherDefault']> | null) {
  setState((s) => {
    const o = { ...s.settings.teacherOverrides };
    if (patch && Object.keys(patch).length) o[id] = patch;
    else delete o[id];
    return { ...s, settings: { ...s.settings, teacherOverrides: o } };
  });
}
export function setNoteOptions(cat: NoteCategory, options: string[]) {
  setState((s) => ({ ...s, settings: { ...s.settings, notes: { ...s.settings.notes, [cat]: options } } }));
}
export function resetDemo() {
  replaceState(buildSeed());
}

export { borrowerOf };
