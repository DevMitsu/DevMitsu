import { useId, useMemo, useRef, useState } from 'react';
import { norm } from '../../domain/rules';
import { cn } from '../../lib/cn';

export interface Suggestion { value: string; hint?: string }

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Called when a suggestion is chosen from the list. */
  onPick?: (s: Suggestion) => void;
  suggestions: Suggestion[];
  hint?: string;
  placeholder?: string;
  autoFocus?: boolean;
}

/** A text box that offers things typed or entered before, as soon as letters match. */
export function SuggestField({ label, value, onChange, onPick, suggestions, hint, placeholder, autoFocus }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const closeTimer = useRef<number>(0);

  const list = useMemo(() => {
    const q = norm(value);
    if (!q) return [];
    const words = q.split(' ');
    const scored = suggestions
      .filter((s) => words.every((w) => norm(`${s.value} ${s.hint ?? ''}`).includes(w)) && norm(s.value) !== q)
      .map((s) => ({ s, rank: norm(s.value).startsWith(q) ? 0 : 1 }))
      .sort((a, b) => a.rank - b.rank || a.s.value.localeCompare(b.s.value));
    return scored.slice(0, 6).map((x) => x.s);
  }, [value, suggestions]);

  const pick = (s: Suggestion) => { onChange(s.value); onPick?.(s); setOpen(false); setCursor(-1); };

  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink">{label}</label>
      <input
        id={id}
        value={value}
        autoFocus={autoFocus}
        autoComplete="off"
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open && list.length > 0}
        aria-autocomplete="list"
        onChange={(e) => { onChange(e.target.value); setOpen(true); setCursor(-1); }}
        onFocus={() => { window.clearTimeout(closeTimer.current); setOpen(true); }}
        onBlur={() => { closeTimer.current = window.setTimeout(() => setOpen(false), 120); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && list.length) { e.preventDefault(); setOpen(true); setCursor((c) => Math.min(c + 1, list.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
          else if (e.key === 'Enter' && open && cursor >= 0 && list[cursor]) { e.preventDefault(); pick(list[cursor]!); }
          else if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); }
        }}
        className="h-10 w-full rounded-control border border-line bg-panel px-3 text-sm text-ink placeholder:text-muted hover:border-primary/40"
      />
      {open && list.length > 0 && (
        <ul role="listbox" className="absolute top-full right-0 left-0 z-30 mt-1 overflow-hidden rounded-control border border-line bg-panel">
          {list.map((s, i) => (
            <li key={s.value} role="option" aria-selected={i === cursor}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(s)} className={cn('flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm', i === cursor ? 'bg-sage-soft' : 'hover:bg-sage-soft')}>
                <span className="truncate font-medium text-ink">{s.value}</span>
                {s.hint && <span className="shrink-0 text-xs text-muted">{s.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
