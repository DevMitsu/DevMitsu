import { useEffect, useRef, useState } from 'react';
import { TriangleAlert, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import type { Assignment, ClassGroup, DayId, SlotRef, TimetableData } from './types';
import {
  DAY_LABELS,
  formatAssignment,
  formatRange,
  getAssignment,
  slotKey,
} from './utils';
import { WeekGrid } from './WeekGrid';

interface TimetableEditorProps {
  open: boolean;
  data: TimetableData;
  classes: ClassGroup[];
  /** Slot to select when the editor opens. */
  initialSlot: SlotRef;
  saving: boolean;
  onSave: (slot: SlotRef, assignment: Assignment | null) => Promise<void>;
  onClose: () => void;
}

export function TimetableEditor({ open, data, classes, initialSlot, saving, onSave, onClose }: TimetableEditorProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [slot, setSlot] = useState<SlotRef>(initialSlot);
  const [classId, setClassId] = useState('');
  const [section, setSection] = useState('');
  const [message, setMessage] = useState('');

  const loadSlot = (next: SlotRef) => {
    const existing = getAssignment(data, next);
    setSlot(next);
    setClassId(existing?.classId ?? '');
    setSection(existing?.section ?? '');
    setMessage('');
  };

  // Native <dialog> provides focus trapping and Escape handling.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      loadSlot(initialSlot);
      dialog.showModal();
      document.body.style.overflow = 'hidden';
    } else if (!open && dialog.open) {
      dialog.close();
    }
    return () => {
      document.body.style.overflow = '';
    };
    // loadSlot intentionally omitted: it should run only when the editor opens.
  }, [open]);

  const teachingPeriods = data.periods.filter((p) => p.kind === 'teaching');
  const currentClass = classes.find((c) => c.id === classId);
  const existing = getAssignment(data, slot);
  const period = data.periods.find((p) => p.id === slot.periodId)!;
  const draft: Assignment | null = classId && section ? { classId, section } : null;
  const unchanged = !!draft && existing?.classId === draft.classId && existing.section === draft.section;

  // Non-blocking hint: the same class and section already has another period that day.
  const duplicate = draft
    ? data.periods.find(
        (p) =>
          p.id !== slot.periodId &&
          p.kind === 'teaching' &&
          data.assignments[slotKey(slot.day, p.id)]?.classId === draft.classId &&
          data.assignments[slotKey(slot.day, p.id)]?.section === draft.section,
      )
    : undefined;

  const slotName = `${DAY_LABELS[slot.day].long}, ${period.label}`;

  const save = async () => {
    if (!draft) return;
    await onSave(slot, draft);
    setMessage(`Saved ${formatAssignment(draft, classes)} for ${slotName}.`);
  };

  const clear = async () => {
    await onSave(slot, null);
    setClassId('');
    setSection('');
    setMessage(`Cleared ${slotName}.`);
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="editor-title"
      onClose={onClose}
      onClick={(e) => e.target === dialogRef.current && onClose()}
      className="m-auto max-h-[calc(100dvh-1.5rem)] w-[min(52rem,calc(100vw-1.5rem))] overflow-y-auto rounded-panel border border-line bg-panel p-0 text-ink"
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
        <div>
          <h2 id="editor-title" className="text-lg font-semibold">Add / Edit Timetable</h2>
          <p className="mt-0.5 text-[13px] text-muted">
            Choose a period, then assign a class and section. Changes apply to this prototype session only.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close editor"
          className="grid size-9 shrink-0 place-items-center rounded-control text-muted hover:bg-sage-soft hover:text-ink"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <div className="hidden border-b border-line md:block">
        <WeekGrid data={data} classes={classes} onEditSlot={loadSlot} selected={slot} compact />
      </div>

      <form
        className="px-5 py-5 sm:px-6"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Day"
            value={slot.day}
            onChange={(e) => loadSlot({ day: e.target.value as DayId, periodId: slot.periodId })}
          >
            {data.days.map((d) => (
              <option key={d} value={d}>{DAY_LABELS[d].long}</option>
            ))}
          </Select>
          <Select
            label="Period"
            value={slot.periodId}
            onChange={(e) => loadSlot({ day: slot.day, periodId: e.target.value })}
          >
            {teachingPeriods.map((p) => (
              <option key={p.id} value={p.id}>{p.label} ({formatRange(p)})</option>
            ))}
          </Select>
          <Select
            label="Class"
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setSection('');
              setMessage('');
            }}
          >
            <option value="">Select class…</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Select
            label="Section"
            value={section}
            disabled={!currentClass}
            onChange={(e) => {
              setSection(e.target.value);
              setMessage('');
            }}
          >
            <option value="">{currentClass ? 'Select section…' : 'Choose class first'}</option>
            {currentClass?.sections.map((s) => (
              <option key={s} value={s}>Section {s}</option>
            ))}
          </Select>
        </div>

        <div className="mt-4 min-h-6 text-[13px]" role="status" aria-live="polite">
          {duplicate ? (
            <p className="flex items-start gap-2 rounded-control border border-amber/40 bg-amber-soft px-3 py-2 text-ink">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber" aria-hidden />
              <span>
                {draft && formatAssignment(draft, classes)} is already scheduled in {duplicate.label} on{' '}
                {DAY_LABELS[slot.day].long}. You can still save.
              </span>
            </p>
          ) : message ? (
            <p className="font-medium text-primary">{message}</p>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <Button variant="secondary" onClick={clear} disabled={!existing || saving}>
            Clear this period
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Done</Button>
            <Button type="submit" variant="primary" loading={saving} disabled={!draft || unchanged}>
              Save assignment
            </Button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
