import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Info, Search } from 'lucide-react';

const scopes = [
  { label: 'Students', to: '/students' },
  { label: 'Books', to: '/collections' },
  { label: 'Classes', to: '/entries' },
];

/**
 * Interface-only search box. It does not query any records yet;
 * the popover says so rather than implying results.
 */
export function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverId = useId();

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      const typing = /input|textarea|select/i.test((e.target as HTMLElement).tagName);
      if (e.key === '/' && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div ref={rootRef} className="relative w-full max-w-xl" role="search">
      <label htmlFor="global-search" className="sr-only">
        Search students, books, classes
      </label>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
        aria-hidden
      />
      <input
        ref={inputRef}
        id="global-search"
        type="search"
        autoComplete="off"
        value={query}
        placeholder="Search students, books, classes…"
        aria-expanded={open}
        aria-controls={popoverId}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
            inputRef.current?.blur();
          }
        }}
        className="h-10 w-full rounded-control border border-line bg-canvas pr-10 pl-9 text-sm text-ink placeholder:text-muted hover:border-primary/40 focus:bg-panel [&::-webkit-search-cancel-button]:appearance-none"
      />
      <kbd
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-[4px] border border-line bg-panel px-1.5 text-[11px] font-medium text-muted sm:block"
      >
        /
      </kbd>

      {open && (
        <div
          id={popoverId}
          className="absolute top-full right-0 left-0 z-20 mt-2 rounded-panel border border-line bg-panel p-4"
        >
          <p className="flex items-start gap-2 text-[13px] leading-relaxed text-muted">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <span>
              Search isn’t connected yet. Once student and catalogue records exist, results
              {query.trim() && <> for “{query.trim()}”</>} will appear here.
            </span>
          </p>
          <p className="mt-3 text-[11px] font-medium tracking-[0.08em] text-muted uppercase">
            Browse instead
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-2">
            {scopes.map((scope) => (
              <li key={scope.label}>
                <Link
                  to={scope.to}
                  onClick={() => setOpen(false)}
                  className="inline-block rounded-control border border-line px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-sage-soft"
                >
                  {scope.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
