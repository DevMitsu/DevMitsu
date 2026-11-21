import { Check, ChevronDown, MoreVertical, Search, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { Tone } from '../domain/types';
import { Icon } from './icons';

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');

// ---------------------------------------------------------------- buttons

type Variant = 'default' | 'primary' | 'danger' | 'danger-solid' | 'ghost';
export function Button({
  variant = 'default', size, className, ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' }) {
  return (
    <button
      type="button"
      {...p}
      className={cx('btn', variant === 'primary' && 'btn-primary', variant === 'danger' && 'btn-danger', variant === 'danger-solid' && 'btn-danger-solid', variant === 'ghost' && 'btn-ghost', size === 'sm' && 'btn-sm', className)}
    />
  );
}

export function Badge({ tone = 'gray', children, title, className }: { tone?: Tone; children: ReactNode; title?: string; className?: string }) {
  return <span title={title} className={cx('badge', `tone-${tone}`, className)}>{children}</span>;
}

// ---------------------------------------------------------------- layout

export function Card({ children, className, pad = true }: { children: ReactNode; className?: string; pad?: boolean }) {
  return <section className={cx('card', pad && 'p-4', className)}>{children}</section>;
}

export function PageHeader({ title, sub, actions, icon }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; icon?: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          {icon && <Icon name={icon} className="h-5 w-5 text-accent" />}
          {title}
        </h1>
        {sub && <p className="mt-0.5 max-w-3xl text-sm text-muted">{sub}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon = 'package', title, children, action }: { icon?: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-accent"><Icon name={icon} className="h-6 w-6" /></span>
      <h3 className="font-semibold">{title}</h3>
      {children && <p className="max-w-md text-sm text-muted">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div role="tablist" className="no-print mb-4 flex gap-1 overflow-x-auto border-b">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cx('-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap', value === t.id ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink')}
        >
          {t.label}
          {t.count != null && <span className="rounded-full bg-surface2 px-1.5 text-xs text-muted">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg border bg-surface p-0.5">
      {options.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)} aria-pressed={value === o.id} className={cx('rounded-md px-2.5 py-1 text-xs font-medium', value === o.id ? 'bg-accent text-white' : 'text-muted hover:text-ink')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- modal

export function Modal({
  title, onClose, children, footer, size = 'md', sub,
}: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl'; sub?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('input:not([disabled]), select, textarea, button.autofocus');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const w = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} className={cx('card flex max-h-[94vh] w-full flex-col shadow-2xl sm:max-h-[90vh]', w)} style={{ borderRadius: '1rem' }}>
        <header className="flex items-start justify-between gap-3 border-b px-5 py-3.5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold">{title}</h2>
            {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
          </div>
          <button aria-label="Close" onClick={onClose} className="btn btn-ghost btn-icon -mr-2"><X className="h-4 w-4" /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- form bits

export function Field({ label, help, error, required, children, className }: { label: ReactNode; help?: ReactNode; error?: string; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="label">{label}{required && <span className="text-danger"> *</span>}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-danger">{error}</span> : help ? <span className="help block">{help}</span> : null}
    </label>
  );
}

export function Checkbox({ checked, onChange, children, disabled }: { checked: boolean; onChange: (v: boolean) => void; children?: ReactNode; disabled?: boolean }) {
  return (
    <label className={cx('inline-flex cursor-pointer items-center gap-2 text-sm', disabled && 'opacity-50')}>
      <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

export function SearchBox({ value, onChange, placeholder = 'Search…', className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cx('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-faint" />
      <input className="input pl-8" type="search" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} aria-label={placeholder} />
    </div>
  );
}

/** Text input with suggestions from a list, but free typing is allowed. */
export function Suggest({ value, onChange, options, placeholder, ...rest }: { value: string; onChange: (v: string) => void; options: string[]; placeholder?: string } & Record<string, unknown>) {
  const id = useId();
  return (
    <>
      <input {...rest} className="input" list={id} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      <datalist id={id}>{options.map((o) => <option key={o} value={o} />)}</datalist>
    </>
  );
}

export function Menu({ label = 'More', items, icon }: { label?: string; icon?: ReactNode; items: { label: ReactNode; onClick: () => void; danger?: boolean; hidden?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  const shown = items.filter((i) => !i.hidden);
  return (
    <div className="relative" ref={ref}>
      <button type="button" className="btn btn-icon" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {icon ?? <MoreVertical className="h-4 w-4" />}
      </button>
      {open && (
        <div role="menu" className="card absolute right-0 z-40 mt-1 min-w-48 py-1 shadow-xl">
          {shown.map((it, n) => (
            <button key={n} role="menuitem" className={cx('block w-full px-3 py-1.5 text-left text-sm hover:bg-surface2', it.danger && 'text-danger')} onClick={() => { setOpen(false); it.onClick(); }}>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** A dropdown button for choosing from many options (used for "New…" and column pickers). */
export function Popover({ trigger, children, align = 'right' }: { trigger: ReactNode; children: ReactNode; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button type="button" className="btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {trigger}
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </button>
      {open && <div className={cx('card absolute z-40 mt-1 max-h-96 min-w-56 overflow-y-auto p-2 shadow-xl', align === 'right' ? 'right-0' : 'left-0')}>{children}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, tone, to, icon }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone; to?: () => void; icon?: string }) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2 text-xs font-medium text-muted">
        <span>{label}</span>
        {icon && <Icon name={icon} className="h-4 w-4 opacity-70" />}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </>
  );
  const cls = cx('card block w-full p-3.5 text-left', tone && tone !== 'gray' && `border-l-4`, to && 'hover:bg-surface2');
  const style = tone && tone !== 'gray' ? { borderLeftColor: `var(--t-${tone}-fg)` } : undefined;
  return to ? <button type="button" onClick={to} className={cls} style={style}>{body}</button> : <div className={cls} style={style}>{body}</div>;
}

export function Meter({ value, max, tone = 'blue' }: { value: number; max: number; tone?: Tone }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface2" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `var(--t-${tone}-fg)` }} />
    </div>
  );
}

export function Done() {
  return <Check className="h-4 w-4 text-[var(--t-green-fg)]" aria-label="Yes" />;
}
