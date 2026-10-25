# Alexandria

School library management system. **Stage 1: homepage UI prototype** (frontend only, mock data).

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # tsc
npm run build      # typecheck + production build into dist/
```

Optional: create `.env.local` with `VITE_PROFILE_NAME=Your Name` to change the placeholder name in the greeting.

## Structure

```
src/
  app/            shell (TopBar, Sidebar, AppShell), routes, navigation config
  components/ui/  shared primitives (Button, Select, Panel, SegmentedControl)
  config/         placeholder profile
  data/mock/      ALL mock data (timetable, summary figures)
  features/
    home/         homepage: greeting, summary
    timetable/    types, service interface, in-memory service, hook, views, editor
  pages/          "Coming soon" and not-found pages
```

Backend integration seam: implement `TimetableService` (`features/timetable/service.ts`) against an API
and pass it to `useTimetable`. No component needs to change.
