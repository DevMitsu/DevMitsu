import { useEffect, useMemo, useState } from 'react';
import { Plus, TriangleAlert } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Checkbox, TextField } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { toast } from '../../components/ui/toast';
import { classIdsOf, dayOf, formatDay, gradesFor, sectionsOf, classIdOf, todayISO } from '../../domain/rules';
import { effectiveSlot } from '../../domain/queries';
import { LECTURES, formatRange } from '../../domain/schedule';
import { setException, setRegular } from '../../store/actions';
import { useStore } from '../../store/store';
import { shortClasses } from './labels';

interface Props { open: boolean; onClose: () => void; date: string; periodId: string }
type Mode = 'library' | 'proxy' | 'cancel';

const MODES: Array<{ id: Mode; title: string; hint: string }> = [
  { id: 'library', title: 'Class comes to the library', hint: 'The normal case, or a different class for this date.' },
  { id: 'proxy', title: 'Class taken by someone else (proxy)', hint: 'The class did not come to the library. A teacher took it.' },
  { id: 'cancel', title: 'No lecture', hint: 'The lecture does not happen on this date.' },
];

/** Edit one lecture, for one date or for every week. Two classes at once is a deliberate exception. */
export function TimetableEditor({ open, onClose, date: initDate, periodId: initPeriod }: Props) {
  const state = useStore((s) => s);
  const lib = state.activeLibrary;
  const [date, setDate] = useState(initDate);
  const [periodId, setPeriodId] = useState(initPeriod);
  const [scope, setScope] = useState<'date' | 'weekly'>('date');
  const [mode, setMode] = useState<Mode>('library');
  const [c1, setC1] = useState('');
  const [c2, setC2] = useState('');
  const [second, setSecond] = useState(false);
  const [takenBy, setTakenBy] = useState('');
  const [note, setNote] = useState('');
  const [confirmPast, setConfirmPast] = useState(false);

  const classes = useMemo(() => classIdsOf(state.sections, lib), [state.sections, lib]);
  const day = dayOf(date);
  const eff = day ? effectiveSlot(state, lib, date, periodId) : null;
  const period = LECTURES.find((p) => p.id === periodId)!;
  const isPast = date < todayISO();
  const teacherNames = state.teachers.filter((t) => t.active).map((t) => t.name);

  const load = (d: string, p: string) => {
    const e = dayOf(d) ? effectiveSlot(state, lib, d, p) : null;
    const ids = e?.source === 'proxy' ? e.proxied : e?.source === 'cancelled' ? e.regular : e?.classIds ?? [];
    setMode(e?.source === 'proxy' ? 'proxy' : e?.source === 'cancelled' ? 'cancel' : 'library');
    setC1(ids[0] ?? '');
    setC2(ids[1] ?? '');
    setSecond(!!ids[1] && e?.source !== 'proxy' && e?.source !== 'cancelled');
    setTakenBy(e?.exception?.takenBy ?? '');
    setNote(e?.exception?.note ?? '');
    setConfirmPast(false);
  };
  useEffect(() => { if (open) load(date, periodId); }, [open, date, periodId]); // eslint-disable-line

  const effectiveMode: Mode = scope === 'weekly' ? 'library' : mode;
  const chosen = [c1, second && effectiveMode !== 'cancel' ? c2 : ''].filter(Boolean);
  const clash = day && effectiveMode === 'library'
    ? chosen.flatMap((c) => LECTURES.filter((p) => p.id !== periodId && effectiveSlot(state, lib, date, p.id).classIds.includes(c)).map((p) => `${c} already has ${p.label} on this date`))
    : [];

  const errors: string[] = [];
  if (!day) errors.push('That date is a Sunday. The library timetable runs Monday to Saturday.');
  if (second && c1 && c2 && c1 === c2) errors.push('Choose two different classes.');
  if (effectiveMode === 'proxy' && chosen.length && !takenBy.trim()) errors.push('Enter who took the class.');
  const needsPastConfirm = isPast && !confirmPast;

  const clearDate = () => setException(lib, date, periodId, null);

  const save = () => {
    if (!day) return;
    if (scope === 'weekly') {
      if (!chosen.length) return;
      setRegular(lib, day, periodId, chosen);
      clearDate();
      toast(`Every ${day.toUpperCase()}: ${period.label} is now ${shortClasses(chosen)}.`);
    } else if (mode === 'library') {
      if (!chosen.length) return;
      const same = eff && eff.regular.join() === chosen.join() && !note.trim();
      if (same) clearDate();
      else setException(lib, date, periodId, { kind: eff && eff.regular.length ? 'change' : 'add', classIds: chosen, note: note.trim() || undefined });
      toast(`${formatDay(date)}: ${period.label} is ${shortClasses(chosen)} for this date only.`);
    } else if (mode === 'proxy') {
      if (!chosen.length || !takenBy.trim()) return;
      setException(lib, date, periodId, { kind: 'proxy', classIds: chosen, takenBy: takenBy.trim(), note: note.trim() || undefined });
      toast(`${shortClasses(chosen)} was taken by ${takenBy.trim()} (proxy) in ${period.label}.`);
    } else {
      setException(lib, date, periodId, { kind: 'cancel', classIds: [], note: note.trim() || undefined });
      toast(`${period.label} cancelled for ${formatDay(date)}.`);
    }
    onClose();
  };
  const removeWeekly = () => {
    if (!day) return;
    setRegular(lib, day, periodId, []);
    clearDate();
    toast(`${period.label} removed from every ${day.toUpperCase()}.`);
    onClose();
  };
  const revert = () => { clearDate(); toast('Back to the regular timetable for this lecture.'); onClose(); };

  const canSave = !errors.length && !needsPastConfirm && (effectiveMode === 'cancel' ? !!(eff && (eff.regular.length || eff.exception)) : chosen.length > 0);

  return (
    <Modal open={open} onClose={onClose} size="lg" title="Add / Edit Timetable" description="Change one lecture, for one date or for every week."
      footer={<>
        {eff?.exception && <Button variant="ghost" onClick={revert} className="mr-auto">Revert to regular</Button>}
        {scope === 'weekly' && !!eff?.regular.length && <Button variant="secondary" onClick={removeWeekly}>Remove from every week</Button>}
        <Button variant="primary" onClick={save} disabled={!canSave}>Save</Button>
      </>}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Date" type="date" value={date} onChange={(v) => v && setDate(v)} hint={day ? formatDay(date) : 'Sunday: no lectures'} />
          <Select label="Lecture" value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
            {LECTURES.map((p) => <option key={p.id} value={p.id}>{p.label}{p.tag ? ` (${p.tag})` : ''} · {formatRange(p)}</option>)}
          </Select>
        </div>

        {eff && (
          <p className="rounded-control border border-line bg-canvas px-3 py-2 text-[13px] text-muted">
            Now: <span className="font-medium text-ink">
              {eff.source === 'cancelled' ? `No lecture (regular ${shortClasses(eff.regular)})` : eff.source === 'proxy' ? `${shortClasses(eff.proxied)} taken by ${eff.exception?.takenBy ?? 'someone else'} (proxy)` : shortClasses(eff.classIds)}
            </span>
            {(eff.source === 'changed' || eff.source === 'added') && <> · changed for this date</>}
          </p>
        )}

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-ink">Apply to</legend>
          <div className="flex flex-wrap gap-2">
            {([['date', 'This date only'], ['weekly', 'Every week']] as const).map(([v, l]) => (
              <label key={v} className={`flex cursor-pointer items-center gap-2 rounded-control border px-3 py-2 text-sm ${scope === v ? 'border-primary bg-sage-soft' : 'border-line'}`}>
                <input type="radio" name="scope" checked={scope === v} onChange={() => setScope(v)} className="accent-[var(--color-primary)]" />{l}
              </label>
            ))}
          </div>
        </fieldset>

        {scope === 'date' && (
          <fieldset>
            <legend className="mb-1.5 text-[13px] font-medium text-ink">What happens on this date</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {MODES.map((m) => (
                <label key={m.id} className={`cursor-pointer rounded-control border p-3 text-sm ${mode === m.id ? 'border-primary bg-sage-soft' : 'border-line hover:bg-sage-soft/50'}`}>
                  <span className="flex items-center gap-2 font-medium"><input type="radio" name="mode" checked={mode === m.id} onChange={() => setMode(m.id)} className="accent-[var(--color-primary)]" />{m.title}</span>
                  <span className="mt-1 block text-xs text-muted">{m.hint}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {effectiveMode !== 'cancel' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label={effectiveMode === 'proxy' ? 'Class that was taken' : 'Class'} value={c1} onChange={(e) => setC1(e.target.value)}>
              <option value="">Select class…</option>
              {gradesFor(lib).map((g) => <optgroup key={g} label={`Class ${g}`}>{sectionsOf(state.sections, g).map((s) => <option key={s} value={classIdOf(g, s)}>{classIdOf(g, s)}</option>)}</optgroup>)}
            </Select>
            {second ? (
              <div>
                <Select label="Second class (exception)" value={c2} onChange={(e) => setC2(e.target.value)}>
                  <option value="">Select class…</option>
                  {classes.filter((c) => c !== c1).map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
                <button type="button" className="mt-1.5 text-xs font-medium text-accent underline underline-offset-2" onClick={() => { setSecond(false); setC2(''); }}>Remove second class</button>
              </div>
            ) : (
              <div className="flex items-end"><Button variant="secondary" icon={<Plus className="size-4" aria-hidden />} onClick={() => setSecond(true)} disabled={!c1}>Add second class (exception)</Button></div>
            )}
          </div>
        )}

        {scope === 'date' && effectiveMode === 'proxy' && (
          <div>
            <TextField label="Taken by" value={takenBy} onChange={setTakenBy} list="proxy-people" placeholder="The teacher who took the class" hint="Pick a teacher from the list or type a name." />
            <datalist id="proxy-people">{teacherNames.map((n) => <option key={n} value={n} />)}</datalist>
          </div>
        )}
        {scope === 'date' && <TextField label="Reason (optional)" value={note} onChange={setNote} placeholder="e.g. exam revision, sports day" />}

        {second && chosen.length === 2 && effectiveMode === 'library' && (
          <p className="flex items-start gap-2 rounded-control border border-amber/50 bg-amber-soft px-3 py-2 text-[13px] text-ink"><TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber" aria-hidden />Two classes at once is an exception. It will be marked “Combined” on the timetable.</p>
        )}
        {clash.length > 0 && <p className="flex items-start gap-2 rounded-control border border-amber/50 bg-amber-soft px-3 py-2 text-[13px] text-ink"><TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber" aria-hidden />{clash.join('. ')}. You can still save.</p>}
        {isPast && <Checkbox checked={confirmPast} onChange={setConfirmPast} label="This date has passed. Change it anyway." description="Attendance already recorded for that day is not changed." />}
        {errors.map((e) => <p key={e} role="alert" className="text-[13px] text-ink">{e}</p>)}
      </div>
    </Modal>
  );
}
