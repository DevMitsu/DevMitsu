import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { toast } from '../../components/ui/toast';
import { allClassIds, LIBRARIES, libraryForGrade, norm } from '../../domain/rules';
import { libraryOfClassId, searchBooks } from '../../domain/queries';
import type { LibraryId } from '../../domain/types';
import { cn } from '../../lib/cn';
import { switchLibrary } from '../../store/actions';
import { useStore } from '../../store/store';
import { LibraryGate } from './LibraryGate';

type Scope = 'all' | 'class' | 'student' | 'teacher' | 'book' | 'author';
const SCOPES: Array<{ id: Scope; label: string }> = [
  { id: 'all', label: 'All' }, { id: 'class', label: 'Class' }, { id: 'student', label: 'Student' },
  { id: 'teacher', label: 'Teacher' }, { id: 'book', label: 'Book' }, { id: 'author', label: 'Author' },
];
const PREFIX = /^\s*(class|student|teacher|book|author)\b\s*(.*)$/i;

interface Hit { key: string; group: string; title: string; sub: string; tag?: string; go: () => void }

export function GlobalSearch() {
  const navigate = useNavigate();
  const students = useStore((s) => s.students);
  const teachers = useStore((s) => s.teachers);
  const books = useStore((s) => s.books);
  const active = useStore((s) => s.activeLibrary);
  const sections = useStore((s) => s.sections);
  const state = useStore((s) => s);

  const [chip, setChip] = useState<Scope>('all');
  const [raw, setRaw] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [gate, setGate] = useState<{ lib: LibraryId; to: string } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const prefix = PREFIX.exec(raw);
  const scope: Scope = prefix ? (prefix[1]!.toLowerCase() as Scope) : chip;
  const text = (prefix ? prefix[2]! : raw).trim();

  useEffect(() => {
    const down = (e: PointerEvent) => !rootRef.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => {
      const typing = /input|textarea|select/i.test((e.target as HTMLElement).tagName);
      if (e.key === '/' && !typing) { e.preventDefault(); inputRef.current?.focus(); }
    };
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key); };
  }, []);

  const finish = () => { setOpen(false); setRaw(''); inputRef.current?.blur(); };
  const goClass = (classId: string) => {
    const lib = libraryOfClassId(classId)!;
    const to = `/class/${classId}`;
    finish();
    if (lib !== active) setGate({ lib, to });
    else navigate(to);
  };

  const hits: Hit[] = useMemo(() => {
    const out: Hit[] = [];
    const q = norm(text);
    const want = (s: Scope) => scope === 'all' || scope === s;

    if (want('class')) {
      const m = /^(\d{1,2})\s*([a-z])?$/i.exec(text.replace(/^class\s*/i, ''));
      const all = allClassIds(sections);
      const list = m
        ? all.filter((id) => id.startsWith(`${Number(m[1])}${(m[2] ?? '').toUpperCase()}`))
        : !text && scope === 'class' ? all.filter((id) => libraryOfClassId(id) === active) : [];
      list.slice(0, 8).forEach((id) => {
        const lib = libraryOfClassId(id)!;
        const count = students.filter((s) => s.active && `${s.grade}${s.section}` === id).length;
        out.push({ key: `c-${id}`, group: 'Classes', title: `Class ${id}`, sub: `${count} students · ${LIBRARIES[lib].label}`, tag: lib !== active ? `Switch to ${LIBRARIES[lib].short}` : undefined, go: () => goClass(id) });
      });
    }
    if (want('student') && q) {
      const words = q.split(' ');
      students.filter((s) => s.active && words.every((w) => norm(`${s.name} ${s.grNo}`).includes(w))).slice(0, 6).forEach((s) =>
        out.push({ key: `s-${s.id}`, group: 'Students', title: s.name, sub: `Class ${s.grade}${s.section} · ${s.grNo}`, tag: libraryForGrade(s.grade) !== active ? LIBRARIES[libraryForGrade(s.grade)].short : undefined, go: () => { finish(); navigate(`/student/${s.id}`); } }));
    }
    if (want('teacher') && q) {
      const words = q.split(' ');
      teachers.filter((t) => t.active && words.every((w) => norm(`${t.name} ${t.department}`).includes(w))).slice(0, 6).forEach((t) =>
        out.push({ key: `t-${t.id}`, group: 'Teachers', title: t.name, sub: t.department, go: () => { finish(); navigate(`/teacher/${t.id}`); } }));
    }
    if (want('book') && q) {
      searchBooks(state, text, 6).forEach((b) =>
        out.push({ key: `b-${b.id}`, group: 'Books', title: b.title, sub: `#${b.accession} · ${b.author ?? 'Author not recorded'} · ${b.status}`, tag: LIBRARIES[b.library].short, go: () => { finish(); navigate(`/collections?q=${encodeURIComponent(String(b.accession))}&lib=${b.library}`); } }));
    }
    if (want('author') && q) {
      const counts = new Map<string, number>();
      books.forEach((b) => b.author && norm(b.author).includes(q) && counts.set(b.author, (counts.get(b.author) ?? 0) + 1));
      [...counts.entries()].slice(0, 5).forEach(([a, n]) =>
        out.push({ key: `a-${a}`, group: 'Authors', title: a, sub: `${n} book${n > 1 ? 's' : ''}`, go: () => { finish(); navigate(`/collections?q=${encodeURIComponent(a)}`); } }));
    }
    return out;
  }, [text, scope, students, teachers, books, active, state, sections]);

  useEffect(() => setCursor(0), [text, scope]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setCursor((c) => Math.min(c + 1, hits.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === 'Enter' && hits[cursor]) { e.preventDefault(); hits[cursor]!.go(); }
  };

  const showEmpty = open && text && hits.length === 0;
  const authorsMissing = scope === 'author' && text && !books.some((b) => b.author);

  return (
    <div ref={rootRef} className="relative w-full max-w-xl" role="search">
      <label htmlFor="global-search" className="sr-only">Search classes, students, teachers, books and authors</label>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        ref={inputRef}
        id="global-search"
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        autoComplete="off"
        value={raw}
        placeholder="Search students, books, classes…"
        onChange={(e) => { setRaw(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="h-10 w-full rounded-control border border-line bg-canvas pr-10 pl-9 text-sm text-ink placeholder:text-muted hover:border-primary/40 focus:bg-panel [&::-webkit-search-cancel-button]:appearance-none"
      />
      <kbd aria-hidden className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-[4px] border border-line bg-panel px-1.5 text-[11px] font-medium text-muted sm:block">/</kbd>

      {open && (
        <div id={listId} className="absolute top-full right-0 left-0 z-30 mt-2 max-h-[70vh] overflow-y-auto rounded-panel border border-line bg-panel">
          <div className="flex flex-wrap gap-1.5 border-b border-line p-2.5" role="group" aria-label="Search in">
            {SCOPES.map((s) => (
              <button key={s.id} type="button" aria-pressed={scope === s.id} onClick={() => { setChip(s.id); if (prefix) setRaw(prefix[2]!); inputRef.current?.focus(); }}
                className={cn('h-7 rounded-control px-2.5 text-xs font-medium', scope === s.id ? 'bg-sage text-on-sage' : 'text-muted hover:bg-sage-soft hover:text-ink')}>
                {s.label}
              </button>
            ))}
          </div>
          {!text && scope !== 'class' && (
            <p className="px-4 py-4 text-[13px] leading-relaxed text-muted">Pick a type above, then type. Or type it all at once: <span className="font-medium text-ink">class 9B</span>, <span className="font-medium text-ink">student Aarav</span>, <span className="font-medium text-ink">book 1234</span>, <span className="font-medium text-ink">author Dahl</span>. Press Enter to open the first result.</p>
          )}
          {showEmpty && (
            <p className="px-4 py-4 text-[13px] text-muted">
              {authorsMissing ? 'Author data has not been added yet.' : `Nothing found for “${text}”.`}
            </p>
          )}
          <ul role="listbox">
            {hits.map((h, i) => (
              <li key={h.key} role="option" aria-selected={i === cursor}>
                {(i === 0 || hits[i - 1]!.group !== h.group) && <p className="bg-canvas px-4 py-1.5 text-[11px] font-medium tracking-[0.08em] text-muted uppercase">{h.group}</p>}
                <button type="button" onMouseEnter={() => setCursor(i)} onClick={h.go} className={cn('flex w-full items-center gap-3 px-4 py-2 text-left', i === cursor ? 'bg-sage-soft' : '')}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{h.title}</span>
                    <span className="block truncate text-xs text-muted">{h.sub}</span>
                  </span>
                  {h.tag && <Badge tone={h.tag.startsWith('Switch') ? 'amber' : 'neutral'}>{h.tag}</Badge>}
                  {i === cursor && <span className="hidden text-xs text-muted sm:inline">↵ Open</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {gate && (
        <LibraryGate library={gate.lib} open onClose={() => setGate(null)} onUnlocked={() => { switchLibrary(gate.lib); toast(`Now working in the ${LIBRARIES[gate.lib].label}.`); const to = gate.to; setGate(null); navigate(to); }} />
      )}
    </div>
  );
}
