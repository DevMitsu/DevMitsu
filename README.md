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
- **Home**: 11-lecture timetable with breakfast, buffer and reflection time; one-day proxies, cancellations, added lectures, combined (two-class) lectures, weekly edits; pending panel; summary.
- **Entries / class page**: mark who is in the library for a visit, then open a student.
- **Student and teacher file**: Issue / Return boxes (Return above Issue), "Not submitted / will update" in each, fines (₹2 per day after 15 days), partial waivers with a required note, lost books, renew, undo.
- **Pending**: parked returns and issues, resolved through the same panel.
- **Collections**: add, import, export, remove, transfer between libraries. Shared accession numbers show a "which book?" picker.
- **Reports**: date-range lists (circulation, transfers, added, imports, exports, removed, fines waived, student lists) as a table, copy or CSV.
- **Fines, Stats, Attendance**, **Profile** (library, password, name, change password), **Miscellaneous** (move section, year-end move up, lending rules, teacher dues, note options).

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
