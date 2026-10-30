import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CircleCheck, Plus, X } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Checkbox, ErrorList, TextField } from '../../components/ui/Field';
import { notify } from '../../components/ui/toast';
import { Link } from 'react-router-dom';
import { openLoansOf } from '../../domain/queries';
import { computeRollover, type YearPlan } from '../../domain/rollover';
import { gradesFor, sectionsOf } from '../../domain/rules';
import { startNewYear } from '../../store/actions';
import { useStore } from '../../store/store';
import { BulkAddDialog } from '../people/PersonDialogs';
import { cn } from '../../lib/cn';

const GRADES = [...gradesFor('jr'), ...gradesFor('sr')];
const nextLabel = (label: string) => { const y = Number(label.slice(0, 4)) + 1; return `${y}-${String((y + 1) % 100).padStart(2, '0')}`; };
const shiftYear = (iso: string) => `${Number(iso.slice(0, 4)) + 1}${iso.slice(4)}`;

/** A guided change of academic year: classes move up, sections can be re-dealt, then the new year starts. */
export function YearRollover() {
  const state = useStore((s) => s);
  const [step, setStep] = useState(1);
  const [label, setLabel] = useState(nextLabel(state.academicYear.label));
  const [startsOn, setStartsOn] = useState(shiftYear(state.academicYear.startsOn));
  const [endsOn, setEndsOn] = useState(shiftYear(state.academicYear.endsOn));
  const [sections, setSections] = useState<Record<number, string[]>>(() => Object.fromEntries(GRADES.map((g) => [g, [...sectionsOf(state.sections, g)]])));
  const [shuffle, setShuffle] = useState<Record<number, boolean>>({});
  const [clearTimetable, setClearTimetable] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const [letter, setLetter] = useState<Record<number, string>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [doneMsg, setDoneMsg] = useState('');
  const [bulk, setBulk] = useState(false);

  const plan: YearPlan = { label, startsOn, endsOn, sections, shuffle, clearTimetable };
  const result = useMemo(() => computeRollover(state.students, plan), [state.students, label, sections, shuffle]); // eslint-disable-line
  const active = state.students.filter((s) => s.active);
  const withBooks = active.filter((s) => openLoansOf(state, { type: 'student', id: s.id }).length > 0);
  const toSr = active.filter((s) => s.grade === 5).length;

  const addLetter = (g: number) => {
    const l = (letter[g] ?? '').trim().toUpperCase();
    if (!/^[A-Z]$/.test(l) || sections[g]!.includes(l)) return;
    setSections({ ...sections, [g]: [...sections[g]!, l].sort() });
    setLetter({ ...letter, [g]: '' });
  };

  const apply = () => {
    const r = startNewYear(plan);
    setErrors(r.errors);
    if (notify(r)) { setDoneMsg(r.message ?? ''); setConfirm(false); }
  };

  if (doneMsg) {
    return (
      <div className="space-y-4">
        <p className="flex items-start gap-2 text-sm"><CircleCheck className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden /><span><span className="font-semibold">The new year has started.</span> {doneMsg}</span></p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={() => setBulk(true)}>Add new students</Button>
          <Link to="/" className="inline-flex h-10 items-center rounded-control border border-line bg-panel px-4 text-sm font-medium hover:bg-sage-soft">Set the new timetable</Link>
          <Link to="/entries" className="inline-flex h-10 items-center rounded-control border border-line bg-panel px-4 text-sm font-medium hover:bg-sage-soft">See the new classes</Link>
        </div>
        <p className="text-xs text-muted">New admissions, including all of the new class 1, are added after the move so that they are not moved up again.</p>
        {bulk && <BulkAddDialog open onClose={() => setBulk(false)} />}
      </div>
    );
  }

  const steps = ['Year', 'Classes', 'Review'];
  return (
    <div className="space-y-5">
      <ol className="flex flex-wrap gap-2" aria-label="Steps">
        {steps.map((t, i) => (
          <li key={t} className={cn('flex items-center gap-2 rounded-control border px-3 py-1.5 text-[13px] font-medium', step === i + 1 ? 'border-primary bg-sage-soft text-ink' : 'border-line text-muted')}>
            <span className={cn('grid size-5 place-items-center rounded-full text-[11px]', step > i + 1 ? 'bg-primary text-white' : 'bg-canvas')}>{step > i + 1 ? '✓' : i + 1}</span>{t}
          </li>
        ))}
      </ol>
      <ErrorList errors={errors} />

      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-muted">The current year is <span className="font-medium text-ink">{state.academicYear.label}</span>. Check the dates for the new one.</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label="New academic year" value={label} onChange={setLabel} hint="For example 2027-28" />
            <TextField label="Starts on" type="date" value={startsOn} onChange={setStartsOn} />
            <TextField label="Ends on" type="date" value={endsOn} onChange={setEndsOn} hint="Reading challenge books are due by this date" />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <p className="text-sm text-muted">Everyone moves up one class. For each class below, choose its sections for next year, and whether to keep each student’s section or re-deal students evenly across the sections.</p>
          <div className="overflow-x-auto rounded-control border border-line">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead><tr className="border-b border-line bg-canvas text-[11px] tracking-[0.08em] text-muted uppercase"><th className="px-3 py-2 font-medium">Next year</th><th className="px-3 py-2 font-medium">Sections</th><th className="px-3 py-2 font-medium">Students</th><th className="px-3 py-2 font-medium">Re-deal</th></tr></thead>
              <tbody>
                {GRADES.map((g) => {
                  const counts = result.counts[g] ?? {};
                  const total = Object.values(counts).reduce((n, v) => n + v, 0);
                  return (
                    <tr key={g} className="border-b border-line last:border-b-0 align-top">
                      <td className="px-3 py-2.5 font-medium">Class {g}<span className="block text-xs font-normal text-muted">{g === 1 ? 'New admissions' : `from class ${g - 1}`}</span></td>
                      <td className="px-3 py-2.5">
                        <span className="flex flex-wrap items-center gap-1.5">
                          {sections[g]!.map((sec) => (
                            <span key={sec} className="inline-flex items-center gap-1 rounded-control border border-line bg-canvas py-0.5 pr-0.5 pl-2 text-[13px]">{g}{sec}<span className="text-xs text-muted">{counts[sec] ?? 0}</span>
                              <button type="button" disabled={sections[g]!.length <= 1} aria-label={`Remove class ${g}${sec} next year`} onClick={() => setSections({ ...sections, [g]: sections[g]!.filter((x) => x !== sec) })} className="grid size-5 place-items-center rounded text-muted hover:bg-sage hover:text-ink disabled:opacity-30"><X className="size-3.5" aria-hidden /></button></span>
                          ))}
                          <input aria-label={`New section for class ${g}`} maxLength={1} value={letter[g] ?? ''} onChange={(e) => setLetter({ ...letter, [g]: e.target.value.toUpperCase() })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLetter(g); } }} placeholder="E" className="h-7 w-9 rounded-control border border-line bg-panel text-center text-xs uppercase" />
                          <Button size="sm" variant="ghost" onClick={() => addLetter(g)} aria-label={`Add section to class ${g}`}>Add</Button>
                        </span>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">{total}</td>
                      <td className="px-3 py-2.5">{g === 1 ? <span className="text-xs text-muted">—</span> : <Checkbox checked={!!shuffle[g]} onChange={(v) => setShuffle({ ...shuffle, [g]: v })} label="Re-deal" />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <dl className="grid gap-3 sm:grid-cols-4">
            {[['Moving up', result.movedUp], ['Leaving (class 12)', result.left], ['Class 5 to Sr. Library', toSr], ['Re-dealt classes', Object.values(shuffle).filter(Boolean).length]].map(([l, v]) => (
              <div key={l as string} className="rounded-control border border-line p-3"><dt className="text-[13px] text-muted">{l}</dt><dd className="text-xl font-semibold tabular-nums">{v}</dd></div>
            ))}
          </dl>
          {withBooks.length > 0 && <p className="rounded-control border border-amber/50 bg-amber-soft p-3 text-[13px]"><span className="font-medium">{withBooks.length} students still have books out.</span> Their loans carry over to the new year. Class 5 students keep their Jr. loans after moving to the Sr. Library.</p>}
          <Checkbox checked={clearTimetable} onChange={setClearTimetable} label="Clear the timetable" description="Recommended. Class 9B next year is a different group of students, so build the new timetable fresh." />
          <p className="text-[13px] text-muted">Reading challenge entries are kept by year. The new year starts at 0 for everyone, and last year’s remain in the records.</p>
          <div className="flex flex-wrap items-center gap-4 border-t border-line pt-4">
            <Checkbox checked={confirm} onChange={setConfirm} label={`I understand this changes every class and starts ${label}`} />
            <Button variant="primary" disabled={!confirm} onClick={apply}>Start {label}</Button>
          </div>
        </div>
      )}

      <div className="flex gap-2 border-t border-line pt-4">
        <Button icon={<ArrowLeft className="size-4" aria-hidden />} onClick={() => setStep((s) => s - 1)} disabled={step === 1}>Back</Button>
        {step < 3 && <Button variant="primary" icon={<ArrowRight className="size-4" aria-hidden />} onClick={() => setStep((s) => s + 1)} disabled={step === 1 && (!label.trim() || endsOn <= startsOn)}>Next</Button>}
        {step === 1 && endsOn <= startsOn && <Badge tone="amber">The year must end after it starts</Badge>}
      </div>
    </div>
  );
}
