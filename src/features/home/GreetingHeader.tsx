import { mockProfile } from '../../config/profile';
import { useNow } from '../../lib/useNow';

export function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function GreetingHeader() {
  const now = useNow();
  const date = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now);

  return (
    <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
      <h1 className="text-2xl font-semibold text-ink">
        {greetingFor(now)}, {mockProfile.displayName}
      </h1>
      <p className="text-sm text-muted">
        <time dateTime={now.toISOString().slice(0, 10)}>{date}</time>
      </p>
    </header>
  );
}
