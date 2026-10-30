/**
 * MOCK DATA for the prototype. Every name, book, loan and date here is invented.
 * Loan and event dates are generated relative to today so the demo always looks current.
 */
import { DAYS, LECTURES } from '../domain/schedule';

import {
  addDays, classIdOf, dayOf, DEFAULT_SECTIONS, gradesFor, libraryForGrade, nextSchoolDay, todayISO,
} from '../domain/rules';
import type {
  AppEvent, AppState, Book, ChallengeEntry, DayId, LibraryId, Loan, Pending, Fine, Student, Teacher, Timetable,
} from '../domain/types';

export const STATE_VERSION = 5;

function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ['Aarav', 'Diya', 'Kabir', 'Anaya', 'Vivaan', 'Myra', 'Reyansh', 'Saanvi', 'Arjun', 'Ira', 'Advait', 'Kiara',
  'Ishaan', 'Navya', 'Rohan', 'Tara', 'Dev', 'Meera', 'Yash', 'Zoya', 'Aditya', 'Riya', 'Krish', 'Pari', 'Neel', 'Sia',
  'Parth', 'Anika', 'Veer', 'Mahi'];
const LAST = ['Shah', 'Mehta', 'Patel', 'Desai', 'Joshi', 'Rao', 'Nair', 'Iyer', 'Gupta', 'Sharma', 'Verma', 'Kapoor',
  'Trivedi', 'Parikh', 'Bhatt', 'Dave', 'Modi', 'Pandya', 'Thakkar', 'Vyas'];

type T = [title: string, author: string | undefined, type: string];
const JR_TITLES: T[] = [
  ['Charlie and the Chocolate Factory', 'Roald Dahl', 'FICTION'], ['Matilda', 'Roald Dahl', 'FICTION'],
  ['The BFG', 'Roald Dahl', 'FICTION'], ['The Magic Finger', 'Roald Dahl', 'FICTION'],
  ['Fantastic Mr Fox', 'Roald Dahl', 'FICTION'], ["Charlotte's Web", 'E. B. White', 'FICTION'],
  ['Stuart Little', 'E. B. White', 'FICTION'], ['The Jungle Book', 'Rudyard Kipling', 'FICTION'],
  ['Panchatantra Tales', undefined, 'HINDI'], ['Tales of Akbar and Birbal', undefined, 'HINDI'],
  ['Winnie-the-Pooh', 'A. A. Milne', 'FICTION'], ['The Cat in the Hat', 'Dr. Seuss', 'READER'],
  ['Green Eggs and Ham', 'Dr. Seuss', 'READER'], ['The Gruffalo', 'Julia Donaldson', 'READER'],
  ['Where the Wild Things Are', 'Maurice Sendak', 'READER'], ['Heidi', 'Johanna Spyri', 'FICTION'],
  ['Black Beauty', 'Anna Sewell', 'FICTION'], ['Five on a Treasure Island', 'Enid Blyton', 'MYSTERY'],
  ['The Magic Faraway Tree', 'Enid Blyton', 'FICTION'], ['Amelia Bedelia', 'Peggy Parish', 'READER'],
  ['Diary of a Wimpy Kid', 'Jeff Kinney', 'FICTION'], ['Holes', 'Louis Sachar', 'FICTION'],
  ['The Wonderful Wizard of Oz', 'L. Frank Baum', 'FICTION'], ["Alice's Adventures in Wonderland", 'Lewis Carroll', 'FICTION'],
  ['Peter Pan', 'J. M. Barrie', 'FICTION'], ['The Tale of Peter Rabbit', 'Beatrix Potter', 'READER'],
  ['The Blue Umbrella', 'Ruskin Bond', 'FICTION'], ['First Encyclopedia of Animals', undefined, 'ENCYCLOPEDIA'],
  ['My First Dictionary', undefined, 'DICTIONARY'], ['Wonders of the Solar System', undefined, 'NON-FICTION'],
];
const SR_TITLES: T[] = [
  ["Harry Potter and the Philosopher's Stone", 'J. K. Rowling', 'FICTION'], ['The Hobbit', 'J. R. R. Tolkien', 'FICTION'],
  ['To Kill a Mockingbird', 'Harper Lee', 'FICTION'], ['The Alchemist', 'Paulo Coelho', 'FICTION'],
  ['Wings of Fire', 'A. P. J. Abdul Kalam', 'NON-FICTION'], ['The Diary of a Young Girl', 'Anne Frank', 'NON-FICTION'],
  ['Animal Farm', 'George Orwell', 'FICTION'], ['Pride and Prejudice', 'Jane Austen', 'FICTION'],
  ['Great Expectations', 'Charles Dickens', 'FICTION'], ['Romeo and Juliet', 'William Shakespeare', 'CLASS - NOVEL'],
  ['A Brief History of Time', 'Stephen Hawking', 'NON-FICTION'], ['The Story of My Experiments with Truth', 'M. K. Gandhi', 'NON-FICTION'],
  ['Malgudi Days', 'R. K. Narayan', 'FICTION'], ['The Adventures of Sherlock Holmes', 'Arthur Conan Doyle', 'MYSTERY'],
  ['Treasure Island', 'R. L. Stevenson', 'FICTION'], ["Gulliver's Travels", 'Jonathan Swift', 'FICTION'],
  ['The Merchant of Venice', 'William Shakespeare', 'CLASS - NOVEL'], ['Hatchet', 'Gary Paulsen', 'CLASS - NOVEL'],
  ['Number the Stars', 'Lois Lowry', 'CLASS - NOVEL'], ['The Discovery of India', 'Jawaharlal Nehru', 'NON-FICTION'],
  ['Concise Oxford Dictionary', undefined, 'REFERENCE'], ['Atlas of the World', undefined, 'REFERENCE'],
  ['Encyclopedia of Science', undefined, 'REFERENCE'], ['JEE Mathematics Practice Book', undefined, 'ENTRANCE EXAM BOOKS'],
];
const CAMBRIDGE: Array<[string, number]> = [
  ['Cambridge Primary English Learner\'s Book 3', 3], ['Cambridge Primary Mathematics 4', 4], ['Cambridge Primary Science 5', 5],
  ['Cambridge Global English Learner\'s Book 6', 6], ['Cambridge Global English Workbook 7', 7],
  ['Cambridge Checkpoint Mathematics 8', 8], ['Cambridge Checkpoint Science 9', 9], ['Cambridge IGCSE Physics', 10],
  ['Cambridge IGCSE Chemistry', 10], ['Cambridge IGCSE Biology', 11], ['Cambridge AS & A Level Mathematics', 12],
];

function buildBooks(): Book[] {
  const books: Book[] = [];
  let n = 0;
  const add = (b: Omit<Book, 'id'>) => books.push({ ...b, id: `b${++n}` });
  let jrAcc = 1;
  JR_TITLES.forEach(([title, author, type], i) => {
    for (let c = 0; c < 3 + (i % 2); c++) add({ accession: jrAcc++, title, author, type, library: 'jr', collection: 'general', status: 'Available' });
  });
  let srAcc = 30_001;
  SR_TITLES.forEach(([title, author, type], i) => {
    for (let c = 0; c < 3 + (i % 2); c++) add({ accession: srAcc++, title, author, type, library: 'sr', collection: 'general', status: 'Available' });
  });
  let camAcc = 150_001;
  CAMBRIDGE.forEach(([title, grade]) => {
    for (let c = 0; c < 2; c++) add({
      accession: camAcc++, title, author: 'Cambridge University Press', type: 'TEXT - BOOK',
      library: libraryForGrade(grade), collection: 'cambridge', status: 'Available',
    });
  });
  // A few accession numbers shared by different books, as in the real list, to show the "which book?" picker.
  const share = (a: string, b: string, df = false) => { const x = books.find((k) => k.title === a)!, y = books.find((k) => k.title === b)!; y.accession = x.accession; if (df) y.type = 'DF'; };
  // Daily Five (DF) books keep the same accession number as a regular book but are classed "DF".
  share('Charlie and the Chocolate Factory', 'The Gruffalo', true);
  share('Matilda', 'Heidi', true);
  [['Little Red Tractor', 5], ['The Ugly Duckling', 6], ['Sleeping Beauty', 7], ['Goldilocks and the Three Bears', 8]].forEach(([title, acc]) =>
    add({ accession: acc as number, title: title as string, author: undefined, type: 'DF', library: 'jr', collection: 'general', status: 'Available' }));
  // A genuinely shared number (two different regular books) that still needs correcting
  share('Animal Farm', 'Atlas of the World');
  return books;
}

function buildPeople(): { students: Student[]; teachers: Teacher[] } {
  const students: Student[] = [];
  let i = 0;
  for (let grade = 1; grade <= 12; grade++) {
    for (const section of DEFAULT_SECTIONS) {
      for (let k = 0; k < 6; k++, i++) {
        students.push({
          id: `s${i + 1}`, grNo: `GR${String(1001 + i)}`, grade, section,
          name: `${FIRST[(i * 7 + grade) % FIRST.length]} ${LAST[(i * 3 + section.charCodeAt(0)) % LAST.length]}`,
          active: true,
        });
      }
    }
  }
  const departments: Array<[string, string]> = [
    ['Anita Sharma', 'English'], ['Rajesh Iyer', 'Mathematics'], ['Priya Nair', 'Science'], ['Suresh Desai', 'Social Studies'],
    ['Neha Joshi', 'Hindi'], ['Tanvi Bhatt', 'Computer Science'], ['Kiran Patel', 'Physical Education'], ['Leena Mehta', 'Art'],
    ['Vikram Gupta', 'Physics'], ['Ritu Verma', 'Chemistry'],
  ];
  const teachers = departments.map(([name, department], k) => ({ id: `t${k + 1}`, name, department, active: true }));
  return { students, teachers };
}

function buildTimetable(today: string): Timetable {
  const regular = { jr: {} as Record<DayId, Record<string, string[]>>, sr: {} as Record<DayId, Record<string, string[]>> };
  (['jr', 'sr'] as LibraryId[]).forEach((lib, li) => {
    const classes = gradesFor(lib).flatMap((g) => DEFAULT_SECTIONS.map((s) => classIdOf(g, s)));
    DAYS.forEach((day, di) => {
      regular[lib][day] = {};
      LECTURES.forEach((p, pi) => {
        if ((pi + di + li) % 3 !== 0) regular[lib][day][p.id] = [classes[(pi * 3 + di * 5 + li) % classes.length]!];
      });
    });
  });
  const exceptions: Timetable['exceptions'] = { jr: {}, sr: {} };
  const day = nextSchoolDay(today);
  const dow = dayOf(day)!;
  const teacherNames = ['Anita Sharma', 'Rajesh Iyer', 'Priya Nair', 'Suresh Desai'];
  (['jr', 'sr'] as LibraryId[]).forEach((lib, li) => {
    const classes = gradesFor(lib).flatMap((g) => DEFAULT_SECTIONS.map((s) => classIdOf(g, s)));
    const taken = Object.keys(regular[lib][dow]);
    const free = LECTURES.map((p) => p.id).filter((id) => !taken.includes(id));
    exceptions[lib][day] = {};
    // proxy: the class did not come to the library; someone else took it
    if (taken[0]) exceptions[lib][day][taken[0]] = { kind: 'proxy', classIds: regular[lib][dow][taken[0]]!, takenBy: teacherNames[li], note: 'Exam revision' };
    if (taken[1]) exceptions[lib][day][taken[1]] = { kind: 'cancel', classIds: [], note: 'Sports practice' };
    if (taken[2]) exceptions[lib][day][taken[2]] = { kind: 'change', classIds: [classes[2]!, classes[3]!], note: 'Joint reading session' };
    if (free[0]) exceptions[lib][day][free[0]] = { kind: 'add', classIds: [classes[11]!] };
  });
  return { regular, exceptions };
}

export function buildSeed(): AppState {
  const today = todayISO();
  const rand = rng(42);
  const books = buildBooks();
  const { students, teachers } = buildPeople();
  const loans: Loan[] = [];
  const fines: Fine[] = [];
  const pending: Pending[] = [];
  const events: AppEvent[] = [];
  let seq = 0;
  const nid = (p: string) => `${p}${++seq}`;

  // Open and past loans
  const general = books.filter((b) => b.collection === 'general');
  const pickBook = (lib: LibraryId) => {
    const pool = general.filter((b) => b.library === lib && b.status === 'Available');
    return pool[Math.floor(rand() * pool.length)]!;
  };
  for (let k = 0; k < 48; k++) {
    const s = students[Math.floor(rand() * students.length)]!;
    const lib = rand() < 0.12 ? (libraryForGrade(s.grade) === 'jr' ? 'sr' : 'jr') : libraryForGrade(s.grade);
    const b = pickBook(lib);
    const ago = Math.floor(rand() * 26) + 1;
    const issuedOn = addDays(today, -ago);
    loans.push({
      id: nid('l'), borrowerType: 'student', borrowerId: s.id, bookId: b.id, issuedOn, dueOn: addDays(issuedOn, 15),
      crossNote: lib !== libraryForGrade(s.grade) ? 'Borrowed from the other library' : undefined,
    });
    b.status = 'Issued';
  }
  teachers.slice(0, 4).forEach((t, k) => {
    const b = pickBook(k % 2 ? 'sr' : 'jr');
    const issuedOn = addDays(today, -(5 + k * 6));
    loans.push({ id: nid('l'), borrowerType: 'teacher', borrowerId: t.id, bookId: b.id, issuedOn, dueOn: addDays(issuedOn, 15) });
    b.status = 'Issued';
  });
  const cam = books.find((b) => b.collection === 'cambridge' && b.library === 'sr')!;
  loans.push({ id: nid('l'), borrowerType: 'teacher', borrowerId: 't1', bookId: cam.id, issuedOn: addDays(today, -9), dueOn: addDays(today, 6) });
  cam.status = 'Issued';

  for (let k = 0; k < 110; k++) {
    const s = students[Math.floor(rand() * students.length)]!;
    const b = general.filter((x) => x.library === libraryForGrade(s.grade))[Math.floor(rand() * 60)]!;
    const ago = 20 + Math.floor(rand() * 60);
    const issuedOn = addDays(today, -ago);
    const held = 3 + Math.floor(rand() * 20);
    loans.push({
      id: nid('l'), borrowerType: 'student', borrowerId: s.id, bookId: b.id, issuedOn, dueOn: addDays(issuedOn, 15),
      returnedOn: addDays(issuedOn, held),
    });
    if (held > 15) {
      const late = held - 15;
      fines.push({
        id: nid('f'), loanId: loans[loans.length - 1]!.id, borrowerType: 'student', borrowerId: s.id, bookId: b.id,
        createdOn: addDays(issuedOn, held), amount: late * 2, days: late,
        waived: k % 4 === 0 ? late * 2 : 0, collected: k % 4 === 0 ? 0 : late * 2,
        waiveNote: k % 4 === 0 ? 'Librarian discretion' : undefined,
      });
    }
  }
  // two fines still owed
  const open = loans.filter((l) => !l.returnedOn && l.borrowerType === 'student').slice(0, 2);
  open.forEach((l, k) => {
    const copy: Loan = { ...l, id: nid('l'), issuedOn: addDays(today, -40 - k), dueOn: addDays(today, -25 - k), returnedOn: addDays(today, -3 - k) };
    const bk = general.find((b) => b.id !== l.bookId && b.library === 'jr')!;
    copy.bookId = bk.id;
    loans.push(copy);
    fines.push({ id: nid('f'), loanId: copy.id, borrowerType: 'student', borrowerId: l.borrowerId, bookId: bk.id, createdOn: copy.returnedOn!, amount: (22 - k) * 2, days: 22 - k, waived: 0, collected: 0 });
  });

  // Pending items
  const openLoans = loans.filter((l) => !l.returnedOn && l.borrowerType === 'student');
  openLoans.slice(2, 5).forEach((l, k) => {
    pending.push({ id: nid('p'), kind: 'return', borrowerType: 'student', borrowerId: l.borrowerId, loanIds: [l.id], text: '', createdOn: addDays(today, -(k * 3 + 1)) });
  });
  pending.push({ id: nid('p'), kind: 'issue', borrowerType: 'student', borrowerId: students[30]!.id, loanIds: [], text: 'Took a mystery novel from the shelf, title to be entered', createdOn: addDays(today, -2) });
  pending.push({ id: nid('p'), kind: 'issue', borrowerType: 'teacher', borrowerId: 't5', loanIds: [], text: 'Two Hindi reference books', createdOn: addDays(today, -6) });

  // Inventory events for the reports
  const evBook = (i: number) => books[i]!;
  const ev = (e: Omit<AppEvent, 'id'>) => events.push({ ...e, id: nid('e') });
  [[3, 'New purchase'], [9, 'New purchase'], [40, 'Gift']].forEach(([i, note], k) => ev({ date: addDays(today, -(12 + k * 5)), type: 'added', library: evBook(i as number).library, accession: evBook(i as number).accession, title: evBook(i as number).title, note: note as string }));
  [[14, 'Donation received'], [60, 'Donation received']].forEach(([i, note], k) => ev({ date: addDays(today, -(20 + k * 4)), type: 'import', library: evBook(i as number).library, accession: evBook(i as number).accession, title: evBook(i as number).title, note: note as string }));
  ev({ date: addDays(today, -15), type: 'export', library: 'jr', accession: 70, title: 'Torn Picture Book', note: 'Returned to supplier' });
  [[20, 'Lost'], [77, 'Discarded']].forEach(([i, note], k) => ev({ date: addDays(today, -(8 + k * 9)), type: 'removed', library: evBook(i as number).library, accession: evBook(i as number).accession, title: evBook(i as number).title, note: note as string }));
  [[30, 'jr', 'sr'], [31, 'jr', 'sr'], [90, 'sr', 'jr']].forEach(([i, from, to], k) => ev({ date: addDays(today, -(25 + k)), type: 'transfer', from: from as LibraryId, to: to as LibraryId, accession: evBook(i as number).accession, title: evBook(i as number).title, note: 'Moved to suit grade level' }));

  const yr = Number(today.slice(0, 4)) - (Number(today.slice(5, 7)) >= 4 ? 0 : 1);
  const academicYear = { label: `${yr}-${String((yr + 1) % 100).padStart(2, '0')}`, startsOn: `${yr}-04-01`, endsOn: `${yr + 1}-03-31` };
  const entries: ChallengeEntry[] = [];
  const readers = students.filter((s) => s.grade >= 4 && s.grade <= 10);
  [10, 10, 9, 8, 7, 7, 6, 5, 4, 4, 3, 3, 2, 1, 1].forEach((count, k) => {
    const st = readers[(k * 17 + 5) % readers.length]!;
    for (let j = 0; j < count; j++) {
      const t = (st.grade > 5 ? SR_TITLES : JR_TITLES)[(k * 5 + j * 3) % (st.grade > 5 ? SR_TITLES : JR_TITLES).length]!;
      entries.push({ id: nid('c'), studentId: st.id, title: t[0], author: t[1], pages: 200 + ((k * 31 + j * 47) % 260), finishedOn: addDays(academicYear.startsOn, Math.min(150, 12 + j * 14 + k)), year: academicYear.label });
    }
  });
  const presence: AppState['presence'] = {};
  [['9B', 'l3'], ['7A', 'l5'], ['3C', 'l2']].forEach(([cid, slot], k) => {
    const day = addDays(today, -(k + 1));
    const kids = students.filter((s) => `${s.grade}${s.section}` === cid);
    presence[`${day}|${cid}|${slot}`] = Object.fromEntries(kids.map((s, i) => [s.id, i === 2 ? 'absent' : 'present'] as const));
  });

  return {
    version: STATE_VERSION,
    activeLibrary: 'sr',
    names: { jr: 'Librarian', sr: 'Librarian' },
    passwords: { jr: 'jr123', sr: 'sr123' },
    students, teachers, books, loans, pending, fines,
    presence,
    timetable: buildTimetable(today),
    events,
    sections: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, [...DEFAULT_SECTIONS]])),
    academicYear,
    challenge: { target: 10, minPages: 200, entries },
    prefs: { theme: 'system', textSize: 'normal', compact: false, issueMode: 'one', keepOpen: true, warnOverdue: true, blockOverdue: false, timetableView: 'today' },
    memory: { types: [], authors: [], titles: [] },
    settings: {
      studentDues: { loanDays: 15, finePerDay: 2, maxBooks: 3 },
      teacherDefault: { loanDays: 15, finePerDay: 2, maxBooks: 5 },
      teacherOverrides: { t2: { loanDays: 30, finePerDay: 0 } },
      notes: {
        crossLibrary: ['Borrowed from the other library', 'Reading event', 'Teacher request', 'Project work'],
        fineWaiver: ['Book was lost and paid for', 'Medical reason', 'Librarian discretion', 'Library error'],
        transfer: ['Moved to suit grade level', 'Extra copies', 'Class requirement'],
        newBook: ['New purchase', 'Gift', 'Replacement copy'],
        import: ['Donation received', 'Received from another school', 'Bulk purchase'],
        export: ['Returned to supplier', 'Donated out', 'Sent to another school'],
        removal: ['Lost', 'Damaged beyond repair', 'Discarded'],
      },
    },
  };
}
