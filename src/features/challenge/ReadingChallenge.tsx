import { useMemo, useState } from 'react';
import { BookOpenCheck, ChevronDown, ChevronRight, Trash2, Trophy } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ErrorList, TextField } from '../../components/ui/Field';
import { Panel } from '../../components/ui/Panel';
import { Select } from '../../components/ui/Select';
import { SuggestField, type Suggestion } from '../../components/ui/SuggestField';
import { notify } from '../../components/ui/toast';
import { diffDays, formatDate, norm, todayISO } from '../../domain/rules';
import { logChallengeBook, removeChallengeEntry, setChallenge } from '../../store/actions';
import { useStore } from '../../store/store';

/** Each reader reads a set number of long books in the academic year, with no time limit until year end. */
export function ReadingChallenge() {
  const state = useStore((s) => s);
  const { challenge, academicYear: year } = state;
  const today = todayISO();

  const [q, setQ] = useState('');
  const [pick, setPick] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [pages, setPages] = useState('');
  const [date, setDate] = useState(today);
  const [errors, setErrors] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [cls, setCls] = useState('all');

  const entries = useMemo(() => challenge.entries.filter((e) => e.year === year.label), [challenge.entries, year.label]);
  const byStudent = useMemo(() => {
    const m = new Map<string, typeof entries>();
    entries.forEach((e) => m.set(e.studentId, [...(m.get(e.studentId) ?? []), e]));
    return m;
  }, [entries]);
  const rows = useMemo(() => [...byStudent.entries()].map(([id, list]) => ({ student: state.students.find((s) => s.id === id), list })).filter((r) => r.student)
    .sort((a, b) => b.list.length - a.list.length || a.student!.name.localeCompare(b.student!.name)), [byStudent, state.students]);
  const classes = [...new Set(rows.map((r) => `${r.student!.grade}${r.student!.section}`))].sort((a, b) => parseInt(a) - parseInt(b) || a.localeCompare(b));
  const shown = rows.filter((r) => cls === 'all' || `${r.student!.grade}${r.student!.section}` === cls);
  const completed = rows.filter((r) => r.list.length >= challenge.target).length;
  const daysLeft = Math.max(0, diffDays(year.endsOn, today));

  const matches = useMemo(() => (q.trim().length < 2 || pick ? [] : state.students.filter((s) => s.active && norm(`${s.name} ${s.grNo}`).includes(norm(q))).slice(0, 6)), [q, pick, state.students]);
  const picked = state.students.find((s) => s.id === pick);
  const pickedCount = picked ? byStudent.get(picked.id)?.length ?? 0 : 0;

  const titleOptions = useMemo<Suggestion[]>(() => {
    const seen = new Map<string, Suggestion>();
    state.books.forEach((b) => { if (!seen.has(norm(b.title))) seen.set(norm(b.title), { value: b.title, hint: b.author }); });
    state.memory.titles.forEach((t) => { if (!seen.has(norm(t.title))) seen.set(norm(t.title), { value: t.title, hint: t.author }); });
    return [...seen.values()];
  }, [state.books, state.memory.titles]);
  const authorOptions = useMemo<Suggestion[]>(() => [...new Set([...state.books.map((b) => b.author), ...state.memory.authors].filter((a): a is string => !!a))].map((value) => ({ value })), [state.books, state.memory.authors]);

  const log = () => {
    const r = logChallengeBook({ studentId: pick, title, author, pages: Number(pages), finishedOn: date });
    setErrors(r.errors);
    if (notify(r)) { setTitle(''); setAuthor(''); setPages(''); setDate(today); }
  };
  const num = (v: string, min: number) => Math.max(min, Math.floor(Number(v) || min));

  return (
    <section id="challenge" className="mb-6 scroll-mt-24" aria-label="Reading challenge">
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line bg-canvas px-5 py-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold"><Trophy className="size-4 text-accent" aria-hidden />Reading challenge</h2>
            <p className="mt-0.5 max-w-2xl text-[13px] text-muted">Each reader reads <span className="font-medium text-ink">{challenge.target} books</span> of about <span className="font-medium text-ink">{challenge.minPages} pages or more</span> in the academic year {year.label}. There is no time limit, but all must be submitted by year end, {formatDate(year.endsOn)}.</p>
          </div>
          <Badge tone="sage">{daysLeft} days left</Badge>
        </div>

        <dl className="grid grid-cols-2 border-b border-line sm:grid-cols-4">
          {[['Readers started', rows.length], ['Completed', completed], ['Books logged', entries.length], ['Still to finish', Math.max(0, rows.length - completed)]].map(([l, v], i) => (
            <div key={l as string} className={`px-4 py-3 ${i > 0 ? 'sm:border-l sm:border-line' : ''} ${i % 2 ? 'border-l border-line' : ''}`}><dt className="text-[13px] text-muted">{l}</dt><dd className="text-xl font-semibold tabular-nums">{v}</dd></div>
          ))}
        </dl>

        <div className="space-y-4 p-5">
          <h3 className="text-sm font-semibold">Log a finished book</h3>
          <ErrorList errors={errors} />
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <TextField label="Reader" value={picked ? `${picked.name} · ${picked.grade}${picked.section} · ${picked.grNo}` : q} onChange={(v) => { setQ(v); setPick(''); setErrors([]); }} placeholder="Type at least 2 letters of the name or GR no." />
              {!picked && matches.length > 0 && (
                <ul className="mt-1.5 overflow-hidden rounded-control border border-line">{matches.map((s) => <li key={s.id} className="border-b border-line last:border-b-0"><button type="button" onClick={() => setPick(s.id)} className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-sage-soft"><span className="font-medium">{s.name}</span><span className="text-muted">{s.grade}{s.section} · {byStudent.get(s.id)?.length ?? 0} of {challenge.target}</span></button></li>)}</ul>
              )}
              {picked && <p className="mt-1 text-xs text-muted">{pickedCount} of {challenge.target} books so far{pickedCount >= challenge.target ? '. Already completed.' : '.'}</p>}
            </div>
            <SuggestField label="Book title" value={title} onChange={setTitle} suggestions={titleOptions} onPick={(s) => s.hint && !author && setAuthor(s.hint)} placeholder="Titles from the library appear as you type" />
            <SuggestField label="Author (optional)" value={author} onChange={setAuthor} suggestions={authorOptions} />
            <div className="grid grid-cols-2 gap-4">
              <TextField label="Pages" type="number" min={1} inputMode="numeric" value={pages} onChange={setPages} hint={`${challenge.minPages} or more`} />
              <TextField label="Finished on" type="date" value={date} max={today} min={year.startsOn} onChange={(v) => v && setDate(v)} />
            </div>
          </div>
          <Button variant="primary" icon={<BookOpenCheck className="size-4" aria-hidden />} onClick={log} disabled={!pick || !title.trim() || !pages}>Log book</Button>
        </div>

        <div className="border-t border-line">
          <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-4">
            <h3 className="text-sm font-semibold">Progress</h3>
            <Select label="Class" value={cls} onChange={(e) => setCls(e.target.value)} className="w-36"><option value="all">All classes</option>{classes.map((c) => <option key={c}>{c}</option>)}</Select>
          </div>
          {shown.length === 0 ? <p className="px-5 py-10 text-center text-sm text-muted">No books logged yet. Log the first one above.</p> : (
            <ul className="mt-3 divide-y divide-line border-t border-line">
              {shown.slice(0, 30).map(({ student, list }) => {
                const n = list.length; const done = n >= challenge.target; const isOpen = open === student!.id;
                return (
                  <li key={student!.id}>
                    <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : student!.id)} className="flex w-full items-center gap-3 px-5 py-2.5 text-left hover:bg-sage-soft/50">
                      {isOpen ? <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden /> : <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />}
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{student!.name}</span><span className="text-xs text-muted">{student!.grade}{student!.section}</span></span>
                      <span className="hidden w-40 sm:block"><span className="block h-2 rounded-[3px] bg-canvas"><span className="block h-2 rounded-[3px] bg-primary" style={{ width: `${Math.min(100, (n / challenge.target) * 100)}%` }} /></span></span>
                      <span className="w-14 text-right text-sm font-medium tabular-nums">{n} / {challenge.target}</span>
                      {done ? <Badge tone="green">Completed</Badge> : <span className="w-[4.6rem]" />}
                    </button>
                    {isOpen && (
                      <ul className="border-t border-line bg-canvas px-5 py-2">
                        {list.sort((a, b) => a.finishedOn.localeCompare(b.finishedOn)).map((e) => (
                          <li key={e.id} className="flex items-center gap-3 py-1.5 text-[13px]">
                            <span className="min-w-0 flex-1"><span className="font-medium text-ink">{e.title}</span><span className="text-muted">{e.author ? ` · ${e.author}` : ''} · {e.pages} pages · {formatDate(e.finishedOn, { day: 'numeric', month: 'short' })}</span></span>
                            <button type="button" aria-label={`Remove ${e.title}`} onClick={() => removeChallengeEntry(e.id)} className="grid size-7 place-items-center rounded-control text-muted hover:bg-sage-soft hover:text-ink"><Trash2 className="size-3.5" aria-hidden /></button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {shown.length > 30 && <p className="border-t border-line px-5 py-2.5 text-xs text-muted">Showing 30 of {shown.length}. Choose a class to narrow the list.</p>}
        </div>

        <div className="grid gap-4 border-t border-line bg-canvas px-5 py-4 sm:grid-cols-[10rem_10rem_1fr] sm:items-end">
          <TextField label="Books to read" type="number" min={1} value={String(challenge.target)} onChange={(v) => setChallenge({ target: num(v, 1) })} />
          <TextField label="Minimum pages" type="number" min={1} value={String(challenge.minPages)} onChange={(v) => setChallenge({ minPages: num(v, 1) })} />
          <p className="text-xs text-muted">Change these if the rules change. Books already logged stay counted.</p>
        </div>
      </Panel>
    </section>
  );
}
