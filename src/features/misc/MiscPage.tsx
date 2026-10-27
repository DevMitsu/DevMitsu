import { useMemo, useState, type ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Checkbox, TextField } from '../../components/ui/Field';
import { Panel } from '../../components/ui/Panel';
import { PageHeader } from '../../components/ui/PageHeader';
import { Select } from '../../components/ui/Select';
import { notify, toast } from '../../components/ui/toast';
import { openLoansOf } from '../../domain/queries';
import { duesFor, norm, SECTIONS, rupees } from '../../domain/rules';
import type { Dues, NoteCategory } from '../../domain/types';
import { moveStudentSection, promoteAll, resetDemo, setNoteOptions, setStudentDues, setTeacherDefault, setTeacherOverride } from '../../store/actions';
import { useStore } from '../../store/store';

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="mb-6" aria-label={title}>
      <Panel>
        <div className="border-b border-line bg-canvas px-5 py-3"><h2 className="text-base font-semibold">{title}</h2><p className="mt-0.5 text-[13px] text-muted">{description}</p></div>
        <div className="p-5">{children}</div>
      </Panel>
    </section>
  );
}

function DuesInputs({ value, onChange, disabled }: { value: Dues; onChange: (patch: Partial<Dues>) => void; disabled?: boolean }) {
  const num = (v: string, min: number) => Math.max(min, Math.floor(Number(v) || 0));
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <TextField label="Loan period (days)" type="number" min={1} value={String(value.loanDays)} disabled={disabled} onChange={(v) => onChange({ loanDays: num(v, 1) })} />
      <TextField label="Fine per late day (₹)" type="number" min={0} value={String(value.finePerDay)} disabled={disabled} onChange={(v) => onChange({ finePerDay: num(v, 0) })} />
      <TextField label="Books at a time" type="number" min={1} value={String(value.maxBooks)} disabled={disabled} onChange={(v) => onChange({ maxBooks: num(v, 1) })} />
    </div>
  );
}

const NOTE_LABELS: Record<NoteCategory, string> = {
  crossLibrary: 'Cross-library issue', fineWaiver: 'Fine waiver reason', transfer: 'Book transfer', newBook: 'New book', import: 'Import (books in)', export: 'Export (books out)', removal: 'Removal',
};

export function MiscPage() {
  const state = useStore((s) => s);
  const { settings } = state;

  // move a student between sections
  const [q, setQ] = useState('');
  const [pick, setPick] = useState('');
  const [toSec, setToSec] = useState('');
  const matches = useMemo(() => (q.trim().length < 2 ? [] : state.students.filter((s) => s.active && norm(`${s.name} ${s.grNo}`).includes(norm(q))).slice(0, 6)), [q, state.students]);
  const picked = state.students.find((s) => s.id === pick);

  // year-end
  const [confirmUp, setConfirmUp] = useState(false);
  const active = state.students.filter((s) => s.active);
  const withBooks = active.filter((s) => openLoansOf(state, { type: 'student', id: s.id }).length > 0);
  const changeLib = active.filter((s) => s.grade === 5);
  const finishing = active.filter((s) => s.grade === 12);
  const [confirmReset, setConfirmReset] = useState(false);
  const [newOpt, setNewOpt] = useState<Record<string, string>>({});

  return (
    <div>
      <PageHeader title="Miscellaneous" description="Student changes, lending rules, teacher dues and the lists used for notes." />

      <Section title="Move a student to another section" description="For example from 9B to 9D. The student’s history stays with them.">
        <div className="grid gap-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
          <div>
            <TextField label="Find the student" value={picked ? `${picked.name} · ${picked.grNo} · ${picked.grade}${picked.section}` : q} onChange={(v) => { setQ(v); setPick(''); setToSec(''); }} placeholder="Type at least 2 letters of the name or GR no." />
            {!picked && matches.length > 0 && (
              <ul className="mt-1.5 overflow-hidden rounded-control border border-line">{matches.map((s) => <li key={s.id} className="border-b border-line last:border-b-0"><button type="button" onClick={() => { setPick(s.id); setToSec(''); }} className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-sage-soft"><span className="font-medium">{s.name}</span><span className="text-muted">{s.grade}{s.section} · {s.grNo}</span></button></li>)}</ul>
            )}
          </div>
          <Select label="New section" value={toSec} onChange={(e) => setToSec(e.target.value)} disabled={!picked}><option value="">Choose…</option>{SECTIONS.filter((s) => s !== picked?.section).map((s) => <option key={s} value={s}>{picked ? `${picked.grade}${s}` : s}</option>)}</Select>
          <Button variant="primary" disabled={!picked || !toSec} onClick={() => { if (notify(moveStudentSection(pick, toSec))) { setQ(''); setPick(''); setToSec(''); } }}>Move student</Button>
        </div>
      </Section>

      <Section title="Year-end: move everyone up" description="Every class moves up by one and class 12 leaves. Class 5 students move from the Jr. to the Sr. Library.">
        <dl className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-control border border-line p-3"><dt className="text-[13px] text-muted">Students moving up</dt><dd className="text-xl font-semibold tabular-nums">{active.length - finishing.length}</dd></div>
          <div className="rounded-control border border-line p-3"><dt className="text-[13px] text-muted">Class 5 moving to Sr. Library</dt><dd className="text-xl font-semibold tabular-nums">{changeLib.length}</dd></div>
          <div className="rounded-control border border-line p-3"><dt className="text-[13px] text-muted">Class 12 leaving</dt><dd className="text-xl font-semibold tabular-nums">{finishing.length}</dd></div>
        </dl>
        {withBooks.length > 0 && (
          <div className="mb-4 rounded-control border border-amber/50 bg-amber-soft p-3 text-[13px]">
            <p className="font-medium text-ink">{withBooks.length} students still have books. Check these before moving up:</p>
            <p className="mt-1 text-muted">{withBooks.slice(0, 8).map((s) => `${s.name} (${s.grade}${s.section})`).join(', ')}{withBooks.length > 8 ? ` and ${withBooks.length - 8} more` : ''}</p>
            {withBooks.some((s) => s.grade === 5) && <p className="mt-1 text-ink">Class 5 students with Jr. books keep those loans after moving to the Sr. Library.</p>}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <Checkbox checked={confirmUp} onChange={setConfirmUp} label="I understand this changes every student’s class" />
          <Button variant="primary" disabled={!confirmUp} onClick={() => { if (notify(promoteAll())) setConfirmUp(false); }}>Move everyone up</Button>
        </div>
        <p className="mt-3 text-xs text-muted">Use Students → Add many to add the new year’s admissions.</p>
      </Section>

      <Section title="Lending rules" description="Used for every student in both libraries. A late fine starts after the loan period has passed.">
        <DuesInputs value={settings.studentDues} onChange={setStudentDues} />
        <p className="mt-3 text-[13px] text-muted">Example: a book due on day {settings.studentDues.loanDays} is {rupees(settings.studentDues.finePerDay)} on day {settings.studentDues.loanDays + 1} and {rupees(settings.studentDues.finePerDay * 5)} on day {settings.studentDues.loanDays + 5}.</p>
      </Section>

      <Section title="Teacher dues" description="Teachers can borrow any book, including Cambridge books. Set the default, then customise any teacher.">
        <h3 className="mb-2 text-sm font-semibold">Default for all teachers</h3>
        <DuesInputs value={settings.teacherDefault} onChange={setTeacherDefault} />
        <h3 className="mt-6 mb-2 text-sm font-semibold">Individual teachers</h3>
        <ul className="divide-y divide-line rounded-control border border-line">
          {state.teachers.filter((t) => t.active).map((t) => {
            const custom = !!settings.teacherOverrides[t.id];
            const eff = duesFor(state, { type: 'teacher', id: t.id });
            return (
              <li key={t.id} className="p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1"><p className="text-sm font-medium">{t.name}</p><p className="text-xs text-muted">{t.department}</p></div>
                  {custom ? <Badge tone="amber">Custom</Badge> : <Badge>Default</Badge>}
                  <Checkbox checked={custom} onChange={(v) => setTeacherOverride(t.id, v ? { ...eff } : null)} label="Customise" />
                </div>
                {custom && <div className="mt-3"><DuesInputs value={eff} onChange={(patch) => setTeacherOverride(t.id, { ...settings.teacherOverrides[t.id], ...patch })} /></div>}
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Note options" description="The choices shown in note lists. “Other” is always available for a typed note.">
        <div className="grid gap-6 lg:grid-cols-2">
          {(Object.keys(NOTE_LABELS) as NoteCategory[]).map((c) => (
            <div key={c}>
              <h3 className="mb-2 text-sm font-semibold">{NOTE_LABELS[c]}</h3>
              <ul className="mb-2 flex flex-wrap gap-1.5">
                {settings.notes[c].map((o) => <li key={o} className="inline-flex items-center gap-1 rounded-control border border-line bg-canvas py-1 pr-1 pl-2.5 text-[13px]">{o}<button type="button" aria-label={`Remove ${o}`} onClick={() => setNoteOptions(c, settings.notes[c].filter((x) => x !== o))} className="grid size-5 place-items-center rounded text-muted hover:bg-sage hover:text-ink"><X className="size-3.5" aria-hidden /></button></li>)}
                {settings.notes[c].length === 0 && <li className="text-[13px] text-muted">No options. Only “Other” will show.</li>}
              </ul>
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const v = (newOpt[c] ?? '').trim(); if (!v) return; if (settings.notes[c].includes(v)) return toast('That option already exists.', { tone: 'error' }); setNoteOptions(c, [...settings.notes[c], v]); setNewOpt({ ...newOpt, [c]: '' }); }}>
                <input aria-label={`New ${NOTE_LABELS[c]} option`} value={newOpt[c] ?? ''} onChange={(e) => setNewOpt({ ...newOpt, [c]: e.target.value })} placeholder="Add an option" className="h-9 min-w-0 flex-1 rounded-control border border-line bg-panel px-3 text-sm hover:border-primary/40" />
                <Button type="submit" size="sm" icon={<Plus className="size-3.5" aria-hidden />}>Add</Button>
              </form>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Demo data" description="This prototype keeps its changes in this browser. Reset brings back the original dummy data.">
        <div className="flex flex-wrap items-center gap-4">
          <Checkbox checked={confirmReset} onChange={setConfirmReset} label="Replace everything with fresh dummy data" />
          <Button disabled={!confirmReset} onClick={() => { resetDemo(); setConfirmReset(false); toast('Demo data reset.'); }}>Reset demo data</Button>
        </div>
      </Section>
    </div>
  );
}
