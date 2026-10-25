import { Link } from 'react-router-dom';
import { Panel } from '../components/ui/Panel';
import { usePageTitle } from '../lib/usePageTitle';

export function NotFoundPage() {
  usePageTitle('Page not found');
  return (
    <Panel className="px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold text-ink">Page not found</h1>
      <p className="mt-2 text-sm text-muted">That address doesn’t match anything in Alexandria.</p>
      <Link
        to="/"
        className="mt-6 inline-flex h-10 items-center rounded-control bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover"
      >
        Back to Home
      </Link>
    </Panel>
  );
}
