import { Construction } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';

export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <PageHeader title={title} />
      <Panel className="px-6 py-14 text-center sm:py-20">
        <Construction className="mx-auto size-8 text-accent" aria-hidden />
        <p className="mt-4 text-base font-semibold text-ink">Coming soon</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">{description}</p>
      </Panel>
    </div>
  );
}
