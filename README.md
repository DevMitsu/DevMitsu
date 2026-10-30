# Alexandria

School library management system. This is a **working front-end prototype with dummy data**: no backend, no real records.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck
npm run build
```

Changes made in the app are kept in the browser (localStorage). **Miscellaneous → Reset demo data** restores the original dummy data.
Demo passwords: Jr. Library `jr123`, Sr. Library `sr123` (checked in the browser only, so not secure).

## What works

- **Search** (top bar): scope chips or typed prefix (`class 9B`, `student Aarav`, `book 1234`, `author Dahl`); Enter opens the first result. A class of the other library asks for that library's password.
- **Home**: the 11-lecture day (breakfast, buffer and reflection time). One-day changes: a **proxy** means someone else took the class instead of sending it to the library ("taken by" is required), plus cancellations, a different class, an added lecture, and combined (two-class) lectures. Weekly edits too.
- **Entries / class page**: mark who is in the library for a visit, then open a student.
- **Issue / Return**: opens **one book at a time**. Scan or type a book and the app decides: return if the student has it, issue otherwise. Enter confirms. "Not submitted / will update" parks an item in Pending. "Several at once" gives the two-box version. Fines (₹2 per day after 15 days) with partial waivers, lost books, renew, undo.
- **Fines**: plain-language page (To collect, Overdue books, Paid and waived). Waive the whole fine, half or an amount, with a required reason.
- **Collections**: one **Add book** form (the source decides whether it counts as new or an import), transfer, export, remove. Arrange by accession, title, author or genre. Titles, authors and genres typed before are suggested as you type. Daily Five (DF) books may share a number with a regular book.
- **Reports**: date-range lists (circulation, books by author, transfers, added, imports, exports, removed, waived fines, student lists), arranged by date, name or author; copy or CSV.
- **Miscellaneous**: Reading challenge (10 books of 200+ pages a year), new academic year wizard (move classes up, add or re-deal sections), classes and sections, move a student, lending rules, teacher dues, note options.
- **Settings**: light, dark or device theme, text size, compact tables, issue mode, warnings, backup.
- **Pending, Stats, Attendance, Profile** (library, password, name).

## Structure

```
src/
  domain/      types, school-day schedule, rules (due dates, fines), queries
  data/        seed.ts: all dummy data
  store/       store.ts (state + persistence), actions.ts (every change, with validation)
  components/  shared UI (Modal, NoteField, AccessionPicker, toasts, ...)
  app/         shell, navigation, search, library switcher
  features/    home, timetable, circulation, people, collections, reports, fines, pending, misc, profile, stats, attendance
```

All changes go through `store/actions.ts`. To connect a real backend later, replace those functions and the `seed.ts` data source; the screens read through `useStore`.
