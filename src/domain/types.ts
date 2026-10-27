export type LibraryId = 'jr' | 'sr';
export type DayId = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
export type BorrowerType = 'student' | 'teacher';
export interface Borrower {
  type: BorrowerType;
  id: string;
}

export interface Student {
  id: string;
  grNo: string;
  name: string;
  grade: number;
  section: string;
  active: boolean;
}

export interface Teacher {
  id: string;
  name: string;
  department: string;
  active: boolean;
}

export type BookStatus = 'Available' | 'Issued' | 'Lost' | 'Damaged' | 'Discarded' | 'Out of school';
export type Collection = 'general' | 'cambridge';

export interface Book {
  id: string;
  accession: number;
  title: string;
  author?: string;
  type: string;
  library: LibraryId;
  collection: Collection;
  status: BookStatus;
  transferredFrom?: LibraryId;
}

export interface Loan {
  id: string;
  borrowerType: BorrowerType;
  borrowerId: string;
  bookId: string;
  issuedOn: string;
  dueOn: string;
  returnedOn?: string;
  crossNote?: string;
  lost?: { outcome: LostOutcome; note: string };
  renewals?: number;
}
export type LostOutcome = 'Paid' | 'Replaced' | 'Not paid';

export interface Pending {
  id: string;
  kind: 'return' | 'issue';
  borrowerType: BorrowerType;
  borrowerId: string;
  /** For returns not submitted: the loans still with the borrower. */
  loanIds: string[];
  /** For issues to update: what the librarian typed about the books. */
  text: string;
  createdOn: string;
  resolvedOn?: string;
  resolvedNote?: string;
}

export interface Fine {
  id: string;
  loanId: string;
  borrowerType: BorrowerType;
  borrowerId: string;
  bookId: string;
  createdOn: string;
  amount: number;
  waived: number;
  collected: number;
  waiveNote?: string;
}

export type Presence = 'present' | 'absent';

export interface Dues {
  loanDays: number;
  finePerDay: number;
  maxBooks: number;
}

export type NoteCategory = 'crossLibrary' | 'fineWaiver' | 'transfer' | 'newBook' | 'import' | 'export' | 'removal';

export interface Settings {
  studentDues: Dues;
  teacherDefault: Dues;
  teacherOverrides: Record<string, Partial<Dues>>;
  notes: Record<NoteCategory, string[]>;
}

export interface SlotException {
  /** 'proxy' replaces the regular class(es) on one date, 'cancel' removes them, 'add' adds a lecture where none is regular. */
  kind: 'proxy' | 'cancel' | 'add';
  classIds: string[];
  takenBy?: string;
  note?: string;
}

export interface Timetable {
  regular: Record<LibraryId, Record<DayId, Record<string, string[]>>>;
  exceptions: Record<LibraryId, Record<string, Record<string, SlotException>>>;
}

export type EventType = 'added' | 'import' | 'export' | 'removed' | 'transfer' | 'student_moved' | 'promotion';

export interface AppEvent {
  id: string;
  date: string;
  type: EventType;
  library?: LibraryId;
  from?: LibraryId;
  to?: LibraryId;
  accession?: number;
  title?: string;
  detail?: string;
  note?: string;
}

export interface AppState {
  version: number;
  activeLibrary: LibraryId;
  names: Record<LibraryId, string>;
  passwords: Record<LibraryId, string>;
  students: Student[];
  teachers: Teacher[];
  books: Book[];
  loans: Loan[];
  pending: Pending[];
  fines: Fine[];
  /** Keyed by `${date}|${classId}|${slot}`, then student id. */
  presence: Record<string, Record<string, Presence>>;
  timetable: Timetable;
  events: AppEvent[];
  settings: Settings;
}
