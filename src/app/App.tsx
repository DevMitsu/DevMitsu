import { Route, Routes } from 'react-router-dom';
import { HomePage } from '../features/home/HomePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { PlaceholderPage } from '../pages/PlaceholderPage';
import { AppShell } from './layout/AppShell';
import { navItems } from './navigation';

/** Routes for sections other than Home render a placeholder until they are built. */
export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        {navItems
          .filter((item) => item.path !== '/')
          .map((item) => (
            <Route key={item.path} path={item.path} element={<PlaceholderPage />} />
          ))}
        <Route path="/profile" element={<PlaceholderPage title="Profile" description="Your account details." />} />
        <Route path="/settings" element={<PlaceholderPage title="Settings" description="Library and account preferences." />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
