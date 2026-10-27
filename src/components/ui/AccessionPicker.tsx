import { useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Badge } from './Badge';
import { LIBRARIES, norm } from '../../domain/rules';
import type { Book } from '../../domain/types';
import { cn } from '../../lib/cn';

interface Props {
  pool: Book[];
  selected: string[];
  onAdd: (book: Book) => void;
  blockReason?: (b: Book) => string | null;
  placeholder?: string;
  label: string;
  emptyHint?: string;
}

/**
 * Type an accession number or part of a title. If a number belongs to more than one book,
 * every match is listed so the right title is chosen instead of guessing.
 */
export function AccessionPicker({ pool, selected, onAdd, blockReason, placeholder, label, emptyHint }: Props) {
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const query = q.trim();

  const matches = useMemo(() => {
    if (!query) return [];
    if (/^\d+$/.test(query)) {
      const exact = pool.filter((b) => String(b.accession) === query);
      const partial = pool.filter((b) => String(b.accession) !== query && String(b.accession).startsWith(query));
      return [...exact, ...partial].slice(0, 8);
    }
    const words = norm(query).split(' ');
    return pool.filter((b) => words.every((w) => norm(`${b.title} ${b.author ?? ''}`).includes(w))).slice(0, 8);
  }, [pool, query]);

  const exactCount = /^\d+$/.test(query) ? matches.filter((b) => String(b.accession) === query).length : 0;

  const add = (b: Book) => {
    onAdd(b);
    setQ('');
    setMsg('');
    inputRef.current?.focus();
  };

  const onEnter = () => {
    if (!query) return;
    if (!matches.length) return setMsg(emptyHint ?? 'No matching book.');
    const target = exactCount === 1 ? matches[0]! : matches.length === 1 ? matches[0]! : null;
    if (!target) return setMsg('Several books match. Click the right one.');
    const reason = blockReason?.(target);
    if (reason) return setMsg(reason);
    if (selected.includes(target.id)) return setMsg('Already added.');
    add(target);
  };

  return (
    <div>
      <label className="sr-only" htmlFor={`picker-${label}`}>{label}</label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          ref={inputRef}
          id={`picker-${label}`}
          value={q}
          autoComplete="off"
          placeholder={placeholder ?? 'Accession number or title'}
          onChange={(e) => { setQ(e.target.value); setMsg(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter(); } }}
          className="h-10 w-full rounded-control border border-line bg-panel pr-3 pl-9 text-sm text-ink placeholder:text-muted hover:border-primary/40"
        />
      </div>
      {msg && <p className="mt-1.5 text-[13px] text-ink" role="alert">{msg}</p>}
      {query && (
        <div className="mt-2 overflow-hidden rounded-control border border-line">
          {exactCount > 1 && <p className="border-b border-line bg-amber-soft px-3 py-1.5 text-xs font-medium text-ink">Number {query} belongs to {exactCount} books. Which one?</p>}
          {matches.length === 0 && <p className="px-3 py-3 text-[13px] text-muted">{emptyHint ?? 'No matching book.'}</p>}
          <ul>
            {matches.map((b) => {
              const reason = blockReason?.(b) ?? null;
              const isSel = selected.includes(b.id);
              const disabled = !!reason || isSel;
              return (
                <li key={b.id} className="border-b border-line last:border-b-0">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => add(b)}
                    className={cn('flex w-full items-center gap-3 px-3 py-2 text-left text-sm', disabled ? 'cursor-not-allowed bg-canvas text-muted' : 'hover:bg-sage-soft')}
                  >
                    <span className="w-16 shrink-0 font-medium tabular-nums">#{b.accession}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">{b.title}</span>
                      <span className="block truncate text-xs text-muted">{b.author ?? 'Author not recorded'} · {b.type}</span>
                    </span>
                    <Badge>{LIBRARIES[b.library].short}</Badge>
                    {b.collection === 'cambridge' && <Badge tone="navy">Cambridge</Badge>}
                    <span className="shrink-0 text-xs text-muted">{isSel ? 'Added' : reason ?? b.status}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
