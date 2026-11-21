import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import './index.css';
import { AppShell } from './app/AppShell';
import { Setup } from './app/Setup';
import { ALL, activeLabs } from './domain/inventory';
import { AlertsProvider } from './lib/alerts';
import { AlertsPage } from './features/alerts/AlertsPage';
import { StoragePage } from './features/alerts/StoragePage';
import { FinesPage } from './features/fines/FinesPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { DirectoryPage } from './features/directory/DirectoryPage';
import { ItemDetailPage } from './features/inventory/ItemDetailPage';
import { ItemsPage } from './features/inventory/ItemsPage';
import { PracticalsPage } from './features/practicals/PracticalsPage';
import { RecordsPage } from './features/records/RecordsPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { CustomisePage } from './features/settings/CustomisePage';
import { StocktakePage } from './features/stocktake/StocktakePage';
import { useStore } from './store/store';
import { useEffect } from 'react';
import { SignIn } from './app/SignIn';
import { Button } from './components/ui';
import { initAuth, useAuth } from './sync/auth';
import { isConnected } from './sync/config';
import { startSync, stopSync } from './sync/controller';
import { useSyncState } from './sync/status';
import { updateSettings } from './store/actions';
import { signOutAndReload } from './features/settings/signOut';
import { ConfirmHost, ToastHost } from './components/toast';

function Home() {
  const labs = useStore((s) => s.labs);
  let last = ALL;
  try { last = localStorage.getItem('labinventory.scope') ?? ALL; } catch { /* ignore */ }
  const ok = last === ALL || activeLabs({ labs }).some((l) => l.id === last);
  return <Navigate to={`/${ok ? last : ALL}`} replace />;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-full place-items-center p-6 text-center"><div className="max-w-sm space-y-3 text-sm text-muted">{children}</div></div>;
}

/** Shared mode: connects after sign-in and waits for the shared data before showing anything. */
function SharedGate({ username }: { username: string }) {
  const sync = useSyncState();
  const mine = useStore((s) => s.settings.currentUser);
  useEffect(() => { void startSync(); }, []);
  useEffect(() => { if (sync.loaded && !mine) updateSettings({ currentUser: username }); }, [sync.loaded, mine, username]);
  if (sync.status === 'error' && !sync.loaded) {
    return (
      <Centered>
        <p className="text-base font-semibold text-ink">Could not load the shared data</p>
        <p>{sync.detail}</p>
        <div className="flex justify-center gap-2"><Button variant="primary" onClick={async () => { await stopSync(); void startSync(); }}>Try again</Button><Button onClick={signOutAndReload}>Sign out</Button></div>
      </Centered>
    );
  }
  if (!sync.loaded) return <Centered><p className="text-base font-semibold text-ink">Loading the shared lab data…</p></Centered>;
  return <Local />;
}

function Root() {
  const auth = useAuth();
  useEffect(() => { if (isConnected) void initAuth(); }, []);
  if (!isConnected) return <Local />;
  if (!auth.ready) return <Centered><p>Connecting…</p></Centered>;
  if (!auth.session) return <><SignIn /><ToastHost /><ConfirmHost /></>;
  return <SharedGate username={auth.session.username} />;
}

function Local() {
  const done = useStore((s) => s.setupDone);
  if (!done) return <><Setup /><ToastHost /><ConfirmHost /></>;
  return (
    <AlertsProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/:scope" element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="items" element={<ItemsPage />} />
            <Route path="items/:id" element={<ItemDetailPage />} />
            <Route path="m/:moduleId" element={<RecordsPage />} />
            <Route path="fines" element={<FinesPage />} />
            <Route path="stocktake" element={<StocktakePage />} />
            <Route path="storage" element={<StoragePage />} />
            <Route path="practicals" element={<PracticalsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="directory/:which" element={<DirectoryPage />} />
            <Route path="customise" element={<CustomisePage />} />
            <Route path="customise/:tab" element={<CustomisePage />} />
            <Route path="*" element={<Navigate to=".." replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AlertsProvider>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><Root /></StrictMode>);
