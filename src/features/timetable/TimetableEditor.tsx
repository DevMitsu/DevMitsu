import { useEffect, useMemo, useState } from 'react';
import { Plus, TriangleAlert, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Checkbox, TextField } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { toast } from '../../components/ui/toast';
import { classIdOf, dayOf, formatDay, gradesFor, SECTIONS, todayISO } from '../../domain/rules';
import { effectiveSlot } from '../../domain/queries';
import { LECTURES, formatRange } from '../../domain/schedule';
import { setException, setRegular } from '../../store/actions';
import { useStore } from '../../store/store';
import { shortClasses } from './labels';

interface Props { open: boolean; onClose: () => void; date: string; periodId: string }

/**
 * Edit one lecture. Changes apply either to this date only (a proxy, an added lecture or a cancellation)
 * or to every week. Two classes in one lecture is allowed only as a deliberate exception.
 */
export function TimetableEditor({ open, onClose, date: initDate, periodId: initPeriod }: Props) {
  const state = useStore((s) => s);
  const lib = state.activeLibrary;
  const [date, setDate] = useState(initDate);
  const [periodId, setPeriodId] = useState(initPeriod);
  const [scope, setScope] = useState<'date' | 'weekly'>('date');
  const [c1, setC1] = useState('');
  const [c2, setC2] = useState('');
  const [second, setSecond] = useState(false);
  const [takenBy, setTakenBy] = useState('');
  const [note, setNote] = useState('');
  const [confirmPast, setConfirmPast] = useState(false);

  const classes = useMemo(() => gradesFor(lib).flatMap((g) => SECTIONS.map((s) => classIdOf(g, s))), [lib]);
  const day = dayOf(date);
  const eff = day ? effectiveSlot(state, lib, date, periodId) : null;
  const period = LECTURES.find((p) => p.id === periodId)!;
  const isPast = date < todayISO();

  // load the slot's current values whenever the date or lecture changes
  const load = (d: string, p: string) => {
    const e = dayOf(d) ? effectiveSlot(state, lib, d, p) : null;
    setC1(e?.classIds[0] ?? '');
    setC2(e?.classIds[1] ?? '');
    setSecond(!!e?.classIds[1]);
    setTakenBy(e?.exception?.takenBy ?? '');
    setNote(e?.exception?.note ?? '');
    setConfirmPast(false);
  };
  useEffect(() => { if (open) load(date, periodId); }, [open, date, periodId]); // eslint-disable-line

  const chosen = [c1, second ? c2 : ''].filter(Boolean);
  const dup = chosen.filter((c) => c === c1 && chosen.indexOf(c) !== chosen.lastIndexOf(c));
  const clash = day
    ? chosen.flatMap((c) =>
        LECTURES.filter((p) => p.id !== periodId && effectiveSlot(state, lib, date, p.id).classIds.includes(c)).map((p) => `${c} already has ${p.label} on this date`),
      )
    : [];

  const errors: string[] = [];
  if (!day) errors.push('That date is a Sunday. The library timetable runs Monday to Saturday.');
  if (second && c1 && c2 && c1 === c2) errors.push('Choose two different classes.');
  if (isPast && !confirmPast) errors.push('This date has passed. Tick the box to confirm you want to change it.');

  const clearDateException = () => setException(lib, date, periodId, null);

  const save = () => {
    if (!day || !chosen.length) return;
    if (scope === 'weekly') {
      setRegular(lib, day, periodId, chosen);
      clearDateException();
      toast(`Every ${day.toUpperCase()}: ${period.label} is now ${shortClasses(chosen)}.`);
    } else {
      const same = eff && eff.source !== 'cancelled' && eff.regular.join() === chosen.join() && !takenBy.trim() && !note.trim();
      if (same) clearDateException();
      else setException(lib, date, periodId, { kind: eff && eff.regular.length ? 'proxy' : 'add', classIds: chosen, takenBy: takenBy.trim() || undefined, note: note.trim() || undefined });
      toast(`${formatDay(date)}: ${period.label} is ${shortClasses(chosen)} for this date only.`);
    }
    onClose();
  };
  const remove = () => {
    if (!day) return;
    if (scope === 'weekly') {
      setRegular(lib, day, periodId, []);
      clearDateException();
      toast(`${period.label} removed from every ${day.toUpperCase()}.`);
    } else if (eff && eff.regular.length) {
      setException(lib, date, periodId, { kind: 'cancel', classIds: [], note: note.trim() || undefined });
      toast(`${period.label} cancelled for ${formatDay(date)} only.`);
    } else {
      clearDateException();
      toast(`${period.label} cleared for ${formatDay(date)}.`);
    }
    onClose();
  };
  const revert = () => { clearDateException(); toast('Back to the regular timetable for this lecture.'); onClose(); };

  const canRemove = scope === 'weekly' ? !!eff?.regular.length : !!(eff && (eff.regular.length || eff.exception));
  const blocked = errors.length > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Add / Edit Timetable"
      description="Change one lecture. Choose whether it is for this date only or for every week."
      footer={
        <>
          {eff?.exception && <Button variant="ghost" onClick={revert} className="mr-auto">Revert to regular</Button>}
          <Button variant="secondary" onClick={remove} disabled={!day || !canRemove || (isPast && !confirmPast)} icon={<X className="size-4" aria-hidden />}>
            {scope === 'weekly' ? 'Remove from every week' : eff?.regular.length ? 'Cancel for this date' : 'Clear'}
          </Button>
          <Button variant="primary" onClick={save} disabled={blocked || !chosen.length}>Save</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Date" type="date" value={date} onChange={(v) => v && setDate(v)} hint={day ? formatDay(date) : 'Sunday: no lectures'} />
          <Select label="Lecture" value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
            {LECTURES.map((p) => <option key={p.id} value={p.id}>{p.label}{p.tag ? ` (${p.tag})` : ''} · {formatRange(p)}</option>)}
          </Select>
        </div>

        {eff && (
          <p className="rounded-control border border-line bg-canvas px-3 py-2 text-[13px] text-muted">
            Now: <span className="font-medium text-ink">{eff.source === 'cancelled' ? `Cancelled (regular ${shortClasses(eff.regular)})` : shortClasses(eff.classIds)}</span>
            {eff.source !== 'regular' && eff.source !== 'none' && <> · {eff.source === 'proxy' ? 'proxy for this date' : eff.source === 'added' ? 'added for this date' : 'one-day change'}</>}
          </p>
        )}

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-ink">Apply to</legend>
          <div className="flex flex-wrap gap-2">
            {([['date', 'This date only (proxy)'], ['weekly', 'Every week']] as const).map(([v, l]) => (
              <label key={v} className={`flex cursor-pointer items-center gap-2 rounded-control border px-3 py-2 text-sm ${scope === v ? 'border-primary bg-sage-soft' : 'border-line'}`}>
                <input type="radio" name="scope" checked={scope === v} onChange={() => setScope(v)} className="accent-[var(--color-primary)]" />{l}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Class" value={c1} onChange={(e) => setC1(e.target.value)}>
            <option value="">Select class…</option>
            {gradesFor(lib).map((g) => (
              <optgroup key={g} label={`Class ${g}`}>{SECTIONS.map((s) => <option key={s} value={classIdOf(g, s)}>{classIdOf(g, s)}</option>)}</optgroup>
            ))}
          </Select>
          {second ? (
            <div>
              <Select label="Second class (exception)" value={c2} onChange={(e) => setC2(e.target.value)}>
                <option value="">Select class…</option>
                {classes.filter((c) => c !== c1).map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
              <button type="button" className="mt-1.5 text-xs font-medium text-primary underline underline-offset-2" onClick={() => { setSecond(false); setC2(''); }}>Remove second class</button>
            </div>
          ) : (
            <div className="flex items-end">
              <Button variant="secondary" icon={<Plus className="size-4" aria-hidden />} onClick={() => setSecond(true)} disabled={!c1}>Add second class (exception)</Button>
            </div>
          )}
        </div>

        {scope === 'date' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Taken by (optional)" value={takenBy} onChange={setTakenBy} placeholder="e.g. a substitute teacher" />
            <TextField label="Reason (optional)" value={note} onChange={setNote} placeholder="e.g. exam, sports day" />
          </div>
        )}

        {second && chosen.length === 2 && (
          <p className="flex items-start gap-2 rounded-control border border-amber/50 bg-amber-soft px-3 py-2 text-[13px] text-ink"><TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber" aria-hidden />Two classes at once is an exception. It will be marked “Combined” on the timetable.</p>
        )}
        {clash.length > 0 && dup.length === 0 && (
          <p className="flex items-start gap-2 rounded-control border border-amber/50 bg-amber-soft px-3 py-2 text-[13px] text-ink"><TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber" aria-hidden />{clash.join('. ')}. You can still save.</p>
        )}
        {isPast && <Checkbox checked={confirmPast} onChange={setConfirmPast} label="This date has passed. Change it anyway." description="Attendance already recorded for that day is not changed." />}
        {errors.filter((e) => !e.startsWith('This date has passed')).map((e) => <p key={e} role="alert" className="text-[13px] text-ink">{e}</p>)}
      </div>
    </Modal>
  );
}
