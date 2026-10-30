import { Route, Routes } from 'react-router-dom';
import { BorrowerFile } from '../features/circulation/BorrowerFile';
import { ClassPage } from '../features/circulation/ClassPage';
import { EntriesPage } from '../features/circulation/EntriesPage';
import { AttendancePage } from '../features/attendance/AttendancePage';
import { CollectionsPage } from '../features/collections/CollectionsPage';
import { FinesPage } from '../features/fines/FinesPage';
import { HomePage } from '../features/home/HomePage';
import { MiscPage } from '../features/misc/MiscPage';
import { PendingPage } from '../features/pending/PendingPage';
import { ProfilePage } from '../features/profile/ProfilePage';
import { ReportsPage } from '../features/reports/ReportsPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { StatsPage } from '../features/stats/StatsPage';
import { StudentsPage } from '../features/people/StudentsPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { AppShell } from './layout/AppShell';

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="entries" element={<EntriesPage />} />
        <Route path="class/:classId" element={<ClassPage />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="student/:id" element={<BorrowerFile type="student" />} />
        <Route path="teacher/:id" element={<BorrowerFile type="teacher" />} />
        <Route path="pending" element={<PendingPage />} />
        <Route path="collections" element={<CollectionsPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="fines" element={<FinesPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="misc" element={<MiscPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
