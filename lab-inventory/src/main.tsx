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
import { ConfirmHost, ToastHost } from './components/toast';

function Home() {
  const labs = useStore((s) => s.labs);
  let last = ALL;
  try { last = localStorage.getItem('labinventory.scope') ?? ALL; } catch { /* ignore */ }
  const ok = last === ALL || activeLabs({ labs }).some((l) => l.id === last);
  return <Navigate to={`/${ok ? last : ALL}`} replace />;
}

function Root() {
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
