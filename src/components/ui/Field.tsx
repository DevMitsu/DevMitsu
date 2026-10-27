import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string;
  hint?: ReactNode;
  error?: string;
  onChange?: (value: string) => void;
}

export function TextField({ label, hint, error, className, onChange, id, ...rest }: FieldProps) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className={className}>
      <label htmlFor={fid} className="mb-1.5 block text-[13px] font-medium text-ink">{label}</label>
      <input
        id={fid}
        aria-invalid={!!error || undefined}
        onChange={(e) => onChange?.(e.target.value)}
        className={cn(
          'h-10 w-full rounded-control border bg-panel px-3 text-sm text-ink placeholder:text-muted hover:border-primary/40 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-muted',
          error ? 'border-amber' : 'border-line',
        )}
        {...rest}
      />
      {error ? <p className="mt-1 text-xs text-ink">{error}</p> : hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function Checkbox({ label, checked, onChange, disabled, description }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; description?: string }) {
  return (
    <label className={cn('flex items-start gap-2.5 text-sm', disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-primary)]" />
      <span>
        <span className="text-ink">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </span>
    </label>
  );
}

export function ErrorList({ errors }: { errors: string[] }) {
  if (!errors.length) return null;
  return (
    <ul role="alert" className="space-y-1 rounded-control border border-amber/50 bg-amber-soft px-3 py-2 text-[13px] text-ink">
      {errors.map((e) => <li key={e}>{e}</li>)}
    </ul>
  );
}
