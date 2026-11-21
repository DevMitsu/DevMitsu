# Lab Inventory

Inventory and record-keeping for a school's **Physics, Chemistry and Biology labs**: equipment, chemicals and specimens, who used what, accidents, spills, breakage, loans, maintenance, and what the lab needs to buy. Each lab is kept separate, with an "All labs" view across them.

It runs entirely in the browser. On its own there is no server, no account and nothing is uploaded. If you want several teachers on several computers to share the same records live, connect it to a free Supabase database: see [docs/SETUP-SUPABASE.md](docs/SETUP-SUPABASE.md).

## Just want to use it?

Open **`releases/lab-inventory.html`** (double-click it, or put it on a pendrive). On first run, pick your labs and choose whether to start with sample data so you can look around.

> **On its own, your data is stored in the browser on that computer.** (With a shared database connected, it is stored there instead.) Use **Customise → Data & backup → Download backup** regularly. The same backup file moves everything to another computer. The app reminds you when the last backup is more than two weeks old.

## What it does

| | |
|---|---|
| **Labs** | Physics, Chemistry and Biology to start; add more (Computer lab, Science store…). Colour, room, teacher in charge, and the cupboards/shelves/fridges items are kept in. A lab switcher at the top; "All labs" shows everything together. |
| **Inventory** | Equipment, chemicals, glassware, specimens, consumables, safety gear, models. Auto-numbered codes, quantity and unit, reorder level, location, supplier, cost, status, expiry and lot, hazard labels, storage group, calibration schedule. Search, filters, choose your own columns, bulk edit, export, **paste from Excel to import**. Type or scan a code in the search box to open an item. |
| **Stock** | Every change is a line in the item's history: received, used, spilled, broken, disposed, transferred between labs, corrected by a stocktake. Nothing is silently overwritten, and using more than is in stock is refused. |
| **Usage log** | Who used what, how much, for which class and practical. Stock goes down automatically. |
| **Accidents** | Type, severity, people involved, first aid, parents informed, root cause, corrective action, follow-up date and status. "Days since the last accident" on the dashboard. |
| **Spills** | Substance, amount, clean-up method, protective equipment, exposure. Optionally takes the lost amount off the stock. |
| **Breakage & loss, Disposal & waste** | Cause, who, whether it needs replacing, disposal method and reason. Stock goes down. |
| **Issue & return** | Equipment lent to a teacher or class with a due date. Overdue loans are flagged. Returning damaged items can log the breakage in one step. |
| **Requirements** | A purchase-request pipeline (requested → approved → ordered → received). Items below their reorder level are suggested automatically. Receiving an order adds the stock. |
| **Practicals** | List what a practical needs per group. Check whether the lab has enough for *N* groups, raise requirements for what is missing, and record all the usage in one click. |
| **Maintenance** | Calibration, servicing and safety inspections. The next-due date comes from the service interval and feeds the alerts. |
| **Lab sessions, Lab diary** | Which class used the lab, and free-form notes. |
| **Stocktake** | Count what is on the shelves; only the differences are applied, each with a reason in the history. |
| **Alerts** | Low and out of stock, expired and expiring, service due, overdue loans, open accidents and spills, overdue follow-ups, urgent requirements, and **unsafe storage** (acids with bases, oxidisers with flammables…). |
| **Reports** | Hazardous chemical register, stock value, reorder list, expiry, usage (by item, class, practical or person), accident summary, losses, loans, requirements, service schedule, full stock ledger. Print or download as CSV for Excel. |

Light and dark themes, adjustable text size and compact tables, a phone-friendly layout, and **Undo** for the last 40 changes.

## Customising it (Customise in the sidebar)

Nothing about the structure is fixed. All of it is data you can edit:

- **Labs**: add, rename, recolour, archive; edit each lab's storage locations. A new lab can copy another lab's setup.
- **Item categories**: create your own ("Lab coats", "Electronic kits"…). For each: a code prefix, whether it behaves like *equipment* (lent and returned) or a *consumable* (used up), and whether it tracks **expiry**, **hazards and storage group**, or a **service schedule**. Add your own fields (text, number, date, drop-down, tick box, link…) that appear on the item form and can be shown as columns.
- **Forms & logs**: every log is a form. Rename it, switch it off, restrict it to certain labs, reorder it, and add, hide or reorder its questions. Make **entirely new logs** for anything else, such as fridge temperatures, safety drills, visitor books, with their own fields and an optional open/finished status.
- **Lists**: every drop-down (units, classes, accident types, severities, hazard labels, storage groups, statuses, disposal methods…) is editable, with colours. Make new lists for your own fields.
- **Alerts & rules**: how many days before expiry or service to warn; which storage groups must be kept apart; item-code pattern; whether stock may go below zero; default loan length.
- **General**: school name, currency, theme, text size, density.

Built-in questions that the app's logic depends on (for example the item and quantity on a usage entry) are marked with a lock: they can be relabelled but not removed. Everything else can be hidden or changed.

## Importing from Excel

**Items → Import**: paste cells copied from Excel or Google Sheets (or choose a CSV file). The first row is the headings. Recognised headings include Name, Category, Code, Quantity, Unit, Location, Supplier, Cost, Min stock, Fill up to, Status, Expiry, Lot, Hazards, Storage group, Purchase date, Notes, Tags, and the name of any field in your categories (for example *CAS number*). You get a preview with a list of anything that could not be read before anything is added. A template download for each category gives you the right headings.

## Limits worth knowing

- **On its own: one computer, no login.** Data lives in one browser's storage, so two people at two computers do not see each other's changes. Connect a Supabase database to share (see below).
- **Shared mode has no separate roles.** Everyone with a login can change everything, and there is no per-lab permission. Entries are stamped with the signed-in name so the logs show who did what.
- **Capacity (on its own).** Browsers allow about 5 MB of storage. As a guide every 2,000 log entries take about 1 MB, so a typical lab has years of headroom. The app shows how full storage is and warns at 70%. In shared mode the data lives in Supabase and this limit does not apply.
- **Dates and quantities are plain values**, with no time zones. Renaming a choice in a list does not rewrite old entries that used the old name.

## Sharing between computers (Supabase)

Connect a free Supabase project and every teacher and lab assistant, on any computer or phone, signs in with their own username and sees the same labs live. Changes appear on the other computers within a second or two; if the connection drops the app keeps working and saves when it returns. Stock quantities are worked out from the stock history on every computer, so two people using the same chemical at the same moment are both counted. The full setup (about 20 minutes, no coding) is in [docs/SETUP-SUPABASE.md](docs/SETUP-SUPABASE.md); the database is created by running `supabase/schema.sql`.

## For developers

```bash
cd lab-inventory
npm install          # .npmrc sets legacy-peer-deps (works around an npm 10 resolver bug with vitest)
npm run dev          # http://localhost:5173
npm test             # domain rules, importer, reports
npm run typecheck
npm run build        # dist/
npm run build:single # dist/lab-inventory.html: the whole app in one file
```

Vite, React 19, TypeScript, Tailwind 4, immer. No backend.

```
src/
  domain/      pure logic: types, defaults (lists, categories, forms), stock and alert rules, importer, sample data, CSV, dates
  store/       store.ts (state, undo, persistence) and actions.ts (every change, with its validation)
  components/  ui.tsx, FieldInputs.tsx (renders any field definition), charts, toasts
  features/    dashboard, inventory, records (the generic log screen and editor), practicals, stocktake, reports, alerts, directory, settings
```

Two ideas hold it together:

1. **Forms are data.** A log is a `ModuleDef`: a list of `FieldDef`s plus a few flags. The same `FieldGrid` renders every form, and the same `RecordsPage` lists every log, so a custom log gets the whole feature set for free. A module's `kind` (`usage`, `spill`, `breakage`, `disposal`, `loan`, `requisition`, `maintenance`…) is what attaches behaviour such as stock effects, loan availability, or receiving an order.
2. **Stock is a ledger.** `Item.quantity` is only changed by `pushTxn` in `store/actions.ts`, which appends a `StockTxn`. Editing or deleting a log entry writes a reversing `correction` line and applies the new effect, so history is never rewritten. All changes go through `mutate()`, so they are atomic (a thrown rule violation changes nothing), undoable and saved automatically.

Sharing is a separate layer in `src/sync/` and does not change the screens or `actions.ts`:

- `records.ts` turns the state into rows (`snapshot`) and rows back into state (`applyChanges`). An item's `quantity` and a ledger line's `balance` are **not stored**: every computer rebuilds them from the append-only ledger (`rebuildLedger`), which is why concurrent stock use cannot lose a deduction.
- `engine.ts` compares the state with what the database last held, sends the difference as one atomic batch, applies other computers' changes as they arrive, retries when offline, and never overwrites an unsaved local edit with an incoming one. It talks to a `Remote`: `supabaseRemote.ts` is the real database and `memoryRemote.ts` is a stand-in shared between browser tabs (`config { mode: 'memory' }`, password `lab123`) used for testing.
- In shared mode `store.ts` keeps no local copy of the data, and undo is limited to the time before another computer's change arrives.

`npm test` includes tests with two simulated computers and a fake database (`src/sync/sync.test.ts`).

`releases/lab-inventory.html` is the output of `npm run build:single`. Rebuild it after changing the code.
