import { bookById, borrowerName, borrowerOf, fineOwed } from '../../domain/queries';
import { diffDays, duesFor, formatDate, LIBRARIES, lateDays, libraryForGrade, norm, todayISO } from '../../domain/rules';
import type { AppState, EventType, LibraryId } from '../../domain/types';

export type ReportId = 'circulation' | 'authors' | 'transfers' | 'added' | 'imports' | 'exports' | 'removed' | 'students' | 'waived';
export const REPORTS: Array<{ id: ReportId; label: string; hint: string; usesRange: boolean }> = [
  { id: 'circulation', label: 'Circulation', hint: 'Which books are with whom, when they were taken and when they are due.', usesRange: true },
  { id: 'authors', label: 'Books by author', hint: 'Every book arranged by author, with its accession number and status.', usesRange: false },
  { id: 'transfers', label: 'Book transfers', hint: 'Books moved between the Jr. and Sr. libraries.', usesRange: true },
  { id: 'added', label: 'New books added', hint: 'Books added to a library collection.', usesRange: true },
  { id: 'imports', label: 'Imports', hint: 'Books received from outside, such as donations.', usesRange: true },
  { id: 'exports', label: 'Exports', hint: 'Books sent out of the school.', usesRange: true },
  { id: 'removed', label: 'Books removed', hint: 'Books marked lost, damaged or discarded.', usesRange: true },
  { id: 'waived', label: 'Fines waived', hint: 'Fines the librarian waived, with the reason.', usesRange: true },
  { id: 'students', label: 'Student list', hint: 'Students by class and section, as of today.', usesRange: false },
];

export interface Opts {
  from: string;
  to: string;
  library: LibraryId | 'both';
  arrange: 'date' | 'name' | 'author';
  circulation: 'all' | 'out' | 'overdue' | 'returned';
  classId: string;
}
export interface Built { columns: string[]; rows: Array<Array<string | number>> }

const EVENT_FOR: Partial<Record<ReportId, EventType>> = { transfers: 'transfer', added: 'added', imports: 'import', exports: 'export', removed: 'removed' };
const NO_AUTHOR = 'Author not recorded';
const authorOfEvent = (s: AppState, e: { accession?: number; title?: string }) =>
  s.books.find((b) => b.accession === e.accession && norm(b.title) === norm(e.title))?.author ?? '';
const byAuthor = (a: string, b: string) => (!a ? 1 : !b ? -1 : a.localeCompare(b));
const d = (iso: string | undefined) => (iso ? formatDate(iso, { day: '2-digit', month: 'short', year: 'numeric' }) : '');

export function buildReport(s: AppState, id: ReportId, o: Opts): Built {
  const inLib = (l: LibraryId | undefined) => o.library === 'both' || !l || l === o.library;

  const evType = EVENT_FOR[id];
  if (evType) {
    const evs = s.events.filter((e) => e.type === evType && e.date >= o.from && e.date <= o.to && (evType === 'transfer' ? inLib(e.from) || inLib(e.to) : inLib(e.library)));
    evs.sort((a, b) => o.arrange === 'date' ? b.date.localeCompare(a.date)
      : o.arrange === 'author' ? byAuthor(authorOfEvent(s, a), authorOfEvent(s, b)) || (a.title ?? '').localeCompare(b.title ?? '')
      : (a.title ?? '').localeCompare(b.title ?? ''));
    const au = (e: (typeof evs)[number]) => authorOfEvent(s, e) || NO_AUTHOR;
    if (evType === 'transfer') return { columns: ['Date', 'Accession no.', 'Title', 'Author', 'From', 'To', 'Note'], rows: evs.map((e) => [d(e.date), e.accession ?? '', e.title ?? '', au(e), LIBRARIES[e.from!].label, LIBRARIES[e.to!].label, e.note ?? '']) };
    if (evType === 'removed') return { columns: ['Date', 'Library', 'Accession no.', 'Title', 'Author', 'Reason', 'Note'], rows: evs.map((e) => [d(e.date), LIBRARIES[e.library!].label, e.accession ?? '', e.title ?? '', au(e), e.detail ?? '', e.note ?? '']) };
    return { columns: ['Date', 'Library', 'Accession no.', 'Title', 'Author', evType === 'added' ? 'Note' : evType === 'import' ? 'Source' : 'Reason'], rows: evs.map((e) => [d(e.date), LIBRARIES[e.library!].label, e.accession ?? '', e.title ?? '', au(e), e.note ?? '']) };
  }

  if (id === 'waived') {
    const rows = s.fines.filter((f) => f.waived > 0 && f.createdOn >= o.from && f.createdOn <= o.to && inLib(bookById(s, f.bookId)?.library))
      .sort((a, b) => (o.arrange === 'date' ? b.createdOn.localeCompare(a.createdOn) : borrowerName(s, { type: a.borrowerType, id: a.borrowerId }).localeCompare(borrowerName(s, { type: b.borrowerType, id: b.borrowerId }))));
    return { columns: ['Date', 'Borrower', 'Book', 'Fine (₹)', 'Waived (₹)', 'Reason'], rows: rows.map((f) => [d(f.createdOn), borrowerName(s, { type: f.borrowerType, id: f.borrowerId }), bookById(s, f.bookId)?.title ?? '', f.amount, f.waived, f.waiveNote ?? '']) };
  }

  if (id === 'authors') {
    const list = s.books.filter((b) => inLib(b.library)).sort((a, b) => byAuthor(a.author ?? '', b.author ?? '') || a.title.localeCompare(b.title) || a.accession - b.accession);
    return { columns: ['Author', 'Title', 'Accession no.', 'Genre / type', 'Library', 'Status'], rows: list.map((b) => [b.author ?? NO_AUTHOR, b.title, b.accession, b.type, LIBRARIES[b.library].label, b.status]) };
  }

  if (id === 'students') {
    const list = s.students.filter((x) => x.active && (!o.classId || `${x.grade}${x.section}` === o.classId) && (o.library === 'both' || libraryForGrade(x.grade) === o.library))
      .sort((a, b) => a.grade - b.grade || a.section.localeCompare(b.section) || a.name.localeCompare(b.name));
    return { columns: ['Class', 'GR no.', 'Name', 'Library'], rows: list.map((x) => [`${x.grade}${x.section}`, x.grNo, x.name, LIBRARIES[libraryForGrade(x.grade)].label]) };
  }

  // circulation
  const today = todayISO();
  const loans = s.loans.filter((l) => {
    const book = bookById(s, l.bookId);
    if (!inLib(book?.library)) return false;
    if (!(l.issuedOn <= o.to && (l.returnedOn ?? '9999-12-31') >= o.from)) return false;
    const late = lateDays(l.dueOn, l.returnedOn ?? today);
    if (o.circulation === 'out') return !l.returnedOn;
    if (o.circulation === 'returned') return !!l.returnedOn;
    if (o.circulation === 'overdue') return !l.returnedOn && late > 0;
    return true;
  });
  const authorOf = (l: (typeof loans)[number]) => bookById(s, l.bookId)?.author ?? '';
  loans.sort((a, b) => o.arrange === 'date' ? b.issuedOn.localeCompare(a.issuedOn)
    : o.arrange === 'author' ? byAuthor(authorOf(a), authorOf(b)) || (bookById(s, a.bookId)?.title ?? '').localeCompare(bookById(s, b.bookId)?.title ?? '')
    : borrowerName(s, { type: a.borrowerType, id: a.borrowerId }).localeCompare(borrowerName(s, { type: b.borrowerType, id: b.borrowerId })));
  return {
    columns: ['Borrower', 'Class / department', 'Book', 'Author', 'Accession no.', 'Library', 'Taken on', 'Due on', 'Returned on', 'Days held', 'Days late', 'Fine (₹)', 'Note'],
    rows: loans.map((l) => {
      const b = { type: l.borrowerType, id: l.borrowerId };
      const p = borrowerOf(s, b);
      const book = bookById(s, l.bookId);
      const late = lateDays(l.dueOn, l.returnedOn ?? today);
      const fineRec = s.fines.find((f) => f.loanId === l.id);
      const fine = l.returnedOn ? (fineRec ? fineRec.amount : 0) : late * duesFor(s, b).finePerDay;
      return [
        p?.name ?? '', p ? ('grade' in p ? `${p.grade}${p.section}` : p.department) : '', book?.title ?? '', book?.author ?? NO_AUTHOR, book?.accession ?? '', book ? LIBRARIES[book.library].label : '',
        d(l.issuedOn), d(l.dueOn), l.returnedOn ? d(l.returnedOn) : 'Still out', diffDays(l.returnedOn ?? today, l.issuedOn), late, fine,
        [l.lost ? `Lost (${l.lost.outcome})` : '', l.crossNote ? `Cross-library: ${l.crossNote}` : '', fineRec && fineOwed(fineRec) > 0 ? 'Fine owed' : ''].filter(Boolean).join('; '),
      ];
    }),
  };
}

const esc = (v: string | number) => { const t = String(v); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
export const toCsv = (b: Built) => [b.columns, ...b.rows].map((r) => r.map(esc).join(',')).join('\n');
