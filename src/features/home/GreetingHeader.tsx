import { useNow } from '../../lib/useNow';
import { useStore } from '../../store/store';

export function greetingFor(date: Date): string {
  const h = date.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function GreetingHeader() {
  const now = useNow();
  const lib = useStore((s) => s.activeLibrary);
  const name = useStore((s) => s.names[lib]);
  const date = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now);
  return (
    <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
      <h1 className="text-2xl font-semibold text-ink">{greetingFor(now)}, {name}</h1>
      <p className="text-sm text-muted"><time dateTime={now.toISOString().slice(0, 10)}>{date}</time></p>
    </header>
  );
}
