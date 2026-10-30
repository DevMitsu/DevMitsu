import { cn } from '../../lib/cn';

export function Tabs<T extends string>({ label, tabs, value, onChange }: { label: string; tabs: Array<{ value: T; label: string; count?: number }>; value: T; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          aria-pressed={t.value === value}
          onClick={() => onChange(t.value)}
          className={cn(
            '-mb-px h-10 shrink-0 border-b-2 px-4 text-sm font-medium transition-colors',
            t.value === value ? 'border-primary text-accent' : 'border-transparent text-muted hover:text-ink',
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 rounded-[4px] bg-canvas px-1.5 py-0.5 text-[11px] text-muted">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
