import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowLeftRight, Check, Search, UserPlus, X } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Panel } from '../../components/ui/Panel';
import { PageHeader } from '../../components/ui/PageHeader';
import { toast } from '../../components/ui/toast';
import { LibraryGate } from '../../app/layout/LibraryGate';
import { fineOwed, libraryOfClassId, openLoansOf, pendingOf, presenceKey, slotForClass, studentsOfClass } from '../../domain/queries';
import { formatDay, LIBRARIES, norm, parseClassId, rupees, todayISO } from '../../domain/rules';
import { LECTURES, formatRange, periodById } from '../../domain/schedule';
import { clearPresence, markAllPresent, setPresence, switchLibrary } from '../../store/actions';
import { useStore } from '../../store/store';
import { cn } from '../../lib/cn';
import { StudentDialog } from '../people/PersonDialogs';

export function ClassPage() {
  const { classId = '' } = useParams();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const state = useStore((s) => s);
  const active = state.activeLibrary;
  const [q, setQ] = useState('');
  const [gate, setGate] = useState(false);
  const [adding, setAdding] = useState(false);

  const parsed = parseClassId(classId);
  const lib = libraryOfClassId(classId);
  const date = sp.get('date') ?? todayISO();
  const slot = sp.get('slot') ?? (lib ? slotForClass(state, lib, date, classId, LECTURES.map((p) => p.id)) : undefined) ?? 'visit';
  const key = presenceKey(date, classId, slot);
  const students = useMemo(() => studentsOfClass(state, classId), [state, classId]);
  const marks = state.presence[key] ?? {};
  const period = periodById(slot);

  if (!parsed || !lib) {
    return <Panel className="px-6 py-14 text-center"><p className="font-semibold">Class not found</p><Link to="/entries" className="mt-3 inline-block text-sm font-medium text-primary underline">Back to Entries</Link></Panel>;
  }
  if (lib !== active) {
    return (
      <Panel className="mx-auto max-w-lg px-6 py-12 text-center">
        <p className="text-base font-semibold text-ink">Class {classId} belongs to the {LIBRARIES[lib].label}</p>
        <p className="mt-2 text-sm text-muted">You are working in the {LIBRARIES[active].label}. Switch library to open this class.</p>
        <Button variant="primary" className="mt-5" onClick={() => setGate(true)}>Switch to {LIBRARIES[lib].label}</Button>
        <LibraryGate library={lib} open={gate} onClose={() => setGate(false)} onUnlocked={() => { switchLibrary(lib); setGate(false); toast(`Now working in the ${LIBRARIES[lib].label}.`); }} />
      </Panel>
    );
  }

  const present = students.filter((s) => marks[s.id] === 'present').length;
  const absent = students.filter((s) => marks[s.id] === 'absent').length;
  const shown = students.map((s, i) => ({ s, roll: i + 1 })).filter(({ s }) => !q || norm(`${s.name} ${s.grNo}`).includes(norm(q)));

  return (
    <div>
      <PageHeader
        back={<Link to="/entries" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"><ArrowLeft className="size-4" aria-hidden />Entries</Link>}
        title={`Class ${classId}`}
        description={period ? `${period.label} · ${formatRange(period)} · ${formatDay(date)}` : `Library visit · ${formatDay(date)}`}
        actions={<Button icon={<UserPlus className="size-4" aria-hidden />} onClick={() => setAdding(true)}>Add student</Button>}
      />

      <Panel>
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
          <div className="relative min-w-56 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input aria-label="Search in class" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search in class" className="h-10 w-full rounded-control border border-line bg-canvas pr-3 pl-9 text-sm hover:border-primary/40 focus:bg-panel" />
          </div>
          <p className="text-[13px] text-muted" aria-live="polite">
            <span className="font-medium text-ink">{present}</span> in the library · <span className="font-medium text-ink">{absent}</span> absent · {students.length - present - absent} not marked
          </p>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="secondary" icon={<Check className="size-3.5" aria-hidden />} onClick={() => markAllPresent(key, students.map((s) => s.id))}>Mark all present</Button>
            <Button size="sm" variant="ghost" onClick={() => clearPresence(key)} disabled={!present && !absent}>Clear</Button>
          </div>
        </div>

        {students.length === 0 ? (
          <div className="px-5 py-14 text-center"><p className="text-sm font-medium text-ink">No students in this class yet.</p><p className="mt-1 text-sm text-muted">Add students here, or use Add many on the Students page.</p></div>
        ) : shown.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">No student matches “{q}”.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b border-line text-[11px] tracking-[0.08em] text-muted uppercase">
                <th className="hidden w-14 px-4 py-2.5 font-medium sm:table-cell">Roll</th><th className="px-3 py-2.5 font-medium max-sm:pl-4">Student</th><th className="px-3 py-2.5 font-medium">In the library</th><th className="hidden px-3 py-2.5 font-medium md:table-cell">Books held</th><th className="hidden px-3 py-2.5 font-medium md:table-cell">Status</th><th className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
              </tr></thead>
              <tbody>
                {shown.map(({ s, roll }) => {
                  const b = { type: 'student' as const, id: s.id };
                  const held = openLoansOf(state, b).length;
                  const pend = pendingOf(state, b).length;
                  const owed = state.fines.filter((f) => f.borrowerId === s.id && f.borrowerType === 'student').reduce((n, f) => n + fineOwed(f), 0);
                  const m = marks[s.id];
                  return (
                    <tr key={s.id} className={cn('border-b border-line last:border-b-0', m === 'present' && 'bg-sage-soft')}>
                      <td className="hidden px-4 py-2.5 text-muted tabular-nums sm:table-cell">{roll}</td>
                      <td className="px-3 py-2.5 max-sm:pl-4"><Link to={`/student/${s.id}`} className="font-medium text-ink underline-offset-2 hover:text-primary hover:underline">{s.name}</Link><span className="block text-xs text-muted">{s.grNo}<span className="md:hidden"> · {held} book{held === 1 ? '' : 's'}</span></span><span className="mt-1 flex flex-wrap gap-1 md:hidden">{pend > 0 && <Badge tone="amber">{pend} pending</Badge>}{owed > 0 && <Badge tone="amber">{rupees(owed)} owed</Badge>}</span></td>
                      <td className="px-3 py-2">
                        <div role="group" aria-label={`Presence of ${s.name}`} className="inline-flex rounded-control border border-line bg-panel p-0.5">
                          <button type="button" aria-pressed={m === 'present'} onClick={() => setPresence(key, s.id, m === 'present' ? null : 'present')} className={cn('inline-flex h-8 items-center gap-1 rounded-[6px] px-2.5 text-[13px] font-medium', m === 'present' ? 'bg-primary text-white' : 'text-muted hover:text-ink')}><Check className="size-3.5" aria-hidden /><span className="max-sm:sr-only">Present</span></button>
                          <button type="button" aria-pressed={m === 'absent'} onClick={() => setPresence(key, s.id, m === 'absent' ? null : 'absent')} className={cn('inline-flex h-8 items-center gap-1 rounded-[6px] px-2.5 text-[13px] font-medium', m === 'absent' ? 'bg-navy text-white' : 'text-muted hover:text-ink')}><X className="size-3.5" aria-hidden /><span className="max-sm:sr-only">Absent</span></button>
                        </div>
                      </td>
                      <td className="hidden px-3 py-2.5 tabular-nums md:table-cell">{held}</td>
                      <td className="hidden px-3 py-2.5 md:table-cell"><span className="flex flex-wrap gap-1">{pend > 0 && <Badge tone="amber">{pend} pending</Badge>}{owed > 0 && <Badge tone="amber">{rupees(owed)} owed</Badge>}{!pend && !owed && <span className="text-muted">—</span>}</span></td>
                      <td className="px-4 py-2 text-right"><Button size="sm" variant="secondary" icon={<ArrowLeftRight className="size-3.5" aria-hidden />} onClick={() => navigate(`/student/${s.id}?panel=1`)} aria-label={`Issue or return for ${s.name}`}><span className="max-sm:sr-only">Issue / Return</span></Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <p className="mt-3 text-xs text-muted">“In the library” is marked by you for this visit. A student can be in school but not in the library.</p>
      {adding && <StudentDialog open defaults={{ grade: parsed.grade, section: parsed.section }} onClose={() => setAdding(false)} />}
    </div>
  );
}
