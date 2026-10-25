import { useLocation } from 'react-router-dom';
import { Construction } from 'lucide-react';
import { navItems } from '../app/navigation';
import { Panel } from '../components/ui/Panel';
import { usePageTitle } from '../lib/usePageTitle';

interface PlaceholderPageProps {
  title?: string;
  description?: string;
}

/** "Coming soon" screen for sections planned for later stages. */
export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  const { pathname } = useLocation();
  const item = navItems.find((n) => n.path === pathname);
  const heading = title ?? item?.label ?? 'Page';
  const body = description ?? item?.description ?? '';
  usePageTitle(heading);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink">{heading}</h1>
      <Panel className="mt-6 px-6 py-14 text-center sm:py-20">
        <Construction className="mx-auto size-8 text-primary" aria-hidden />
        <p className="mt-4 text-base font-semibold text-ink">Coming soon</p>
        {body && <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">{body}</p>}
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          This section isn’t built yet. It will arrive in a later stage of Alexandria.
        </p>
      </Panel>
    </div>
  );
}
