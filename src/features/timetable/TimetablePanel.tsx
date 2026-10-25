import { useMemo, useState } from 'react';
import { CalendarOff, Info, Pencil, Plus } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Panel } from '../../components/ui/Panel';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { cn } from '../../lib/cn';
import { useNow } from '../../lib/useNow';
import { DayList } from './DayList';
import { TimetableEditor } from './TimetableEditor';
import type { Assignment, DayId, SlotRef } from './types';
import type { TimetableState } from './useTimetable';
import { DAY_LABELS, firstFreeSlot, resolveDisplayDay, slotKey } from './utils';
import { WeekGrid } from './WeekGrid';

type View = 'today' | 'week';

interface TimetablePanelProps {
  state: TimetableState;
  saving: boolean;
  onSave: (slot: SlotRef, assignment: Assignment | null) => Promise<void>;
  onRetry: () => void;
}

export function TimetablePanel({ state, saving, onSave, onRetry }: TimetablePanelProps) {
  const now = useNow();
  const [view, setView] = useState<View>('today');
  const [mobileDay, setMobileDay] = useState<DayId | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorSlot, setEditorSlot] = useState<SlotRef | null>(null);

  const ready = state.status === 'ready' ? state : null;
  const display = useMemo(
    () => (ready ? resolveDisplayDay(now, ready.data.days) : null),
    [ready, now],
  );

  const openEditor = (slot?: SlotRef) => {
    if (!ready || !display) return;
    setEditorSlot(slot ?? firstFreeSlot(ready.data, display.day));
    setEditorOpen(true);
  };

  const summary = (() => {
    if (!ready || !display) return '';
    const teaching = ready.data.periods.filter((p) => p.kind === 'teaching');
    const scheduled = teaching.filter((p) => ready.data.assignments[slotKey(display.day, p.id)]).length;
    return `${DAY_LABELS[display.day].long} · ${scheduled} scheduled · ${teaching.length - scheduled} available`;
  })();

  const dateLabel = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(now);
  const activeMobileDay = mobileDay ?? display?.day ?? 'mon';

  return (
    <Panel aria-labelledby="timetable-heading" className="flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-line px-4 py-4 sm:px-5">
        <div>
          <h2 id="timetable-heading" className="text-lg font-semibold text-ink">
            {view === 'today' ? 'Today’s Timetable' : 'Weekly Timetable'}
          </h2>
          <p className="mt-0.5 text-[13px] text-muted">
            {view === 'today' ? (summary || dateLabel) : 'All library periods, Monday to Saturday'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SegmentedControl<View>
            label="Timetable view"
            value={view}
            onChange={setView}
            options={[
              { value: 'today', label: 'Today' },
              { value: 'week', label: 'Week' },
            ]}
          />
          <Button
            icon={<Pencil className="size-4" aria-hidden />}
            onClick={() => openEditor()}
            disabled={!ready}
          >
            Edit
          </Button>
        </div>
      </div>

      {state.status === 'loading' && <LoadingRows />}

      {state.status === 'error' && (
        <div className="px-5 py-12 text-center">
          <p className="text-sm text-ink">{state.message}</p>
          <Button className="mt-4" onClick={onRetry}>Try again</Button>
        </div>
      )}

      {ready && display && (
        <>
          {view === 'today' && display.isFallback && (
            <p className="flex items-start gap-2 border-b border-line bg-canvas px-4 py-2.5 text-[13px] text-muted sm:px-5">
              <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              {new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(now)} isn’t a school day, so
              this shows {DAY_LABELS[display.day].long}’s timetable.
            </p>
          )}

          {view === 'today' ? (
            ready.data.periods.some((p) => p.kind === 'teaching') ? (
              <DayList
                data={ready.data}
                classes={ready.classes}
                day={display.day}
                now={display.isFallback ? undefined : now}
                onEditSlot={openEditor}
              />
            ) : (
              <EmptyState />
            )
          ) : (
            <>
              {/* Phones: one day at a time, in the same list used for Today */}
              <div className="md:hidden">
                <div role="group" aria-label="Choose day" className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2">
                  {ready.data.days.map((d) => (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={d === activeMobileDay}
                      onClick={() => setMobileDay(d)}
                      className={cn(
                        'h-9 min-w-12 shrink-0 rounded-control px-3 text-[13px] font-medium',
                        d === activeMobileDay ? 'bg-sage text-navy' : 'text-muted hover:bg-sage-soft',
                      )}
                    >
                      {DAY_LABELS[d].short}
                    </button>
                  ))}
                </div>
                <DayList
                  data={ready.data}
                  classes={ready.classes}
                  day={activeMobileDay}
                  onEditSlot={openEditor}
                />
              </div>
              <div className="hidden md:block">
                <WeekGrid
                  data={ready.data}
                  classes={ready.classes}
                  highlightDay={display.isFallback ? null : display.day}
                  onEditSlot={openEditor}
                />
              </div>
            </>
          )}
        </>
      )}

      <button
        type="button"
        onClick={() => openEditor()}
        disabled={!ready}
        className="flex h-12 w-full items-center justify-center gap-2 border-t border-line bg-primary text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus className="size-4" aria-hidden />
        Add / Edit Timetable
      </button>

      {ready && editorSlot && (
        <TimetableEditor
          open={editorOpen}
          data={ready.data}
          classes={ready.classes}
          initialSlot={editorSlot}
          saving={saving}
          onSave={onSave}
          onClose={() => setEditorOpen(false)}
        />
      )}
    </Panel>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-px" role="status" aria-label="Loading timetable">
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i} className="h-12 animate-pulse border-b border-line bg-canvas" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="px-5 py-14 text-center">
      <CalendarOff className="mx-auto size-7 text-muted" aria-hidden />
      <p className="mt-3 text-sm font-medium text-ink">No periods configured</p>
      <p className="mt-1 text-sm text-muted">Add periods to start building the timetable.</p>
    </div>
  );
}
