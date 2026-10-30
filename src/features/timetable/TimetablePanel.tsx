import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarOff, ChevronLeft, ChevronRight, DoorOpen, Pencil, Plus } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Panel } from '../../components/ui/Panel';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { LIBRARIES, addDays, dayOf, formatDate, nextSchoolDay, todayISO } from '../../domain/rules';
import { effectiveSlot } from '../../domain/queries';
import { DAYS, DAY_LABELS, PERIODS, currentPeriod, formatRange, periodEnded } from '../../domain/schedule';
import { cn } from '../../lib/cn';
import { useNow } from '../../lib/useNow';
import { getState, useStore } from '../../store/store';
import { shortClasses, slotTag } from './labels';
import { TimetableEditor } from './TimetableEditor';
import { WeekGrid, weekStart } from './WeekGrid';

type View = 'today' | 'week';

export function TimetablePanel() {
  const navigate = useNavigate();
  const now = useNow();
  const state = useStore((s) => s);
  const lib = state.activeLibrary;
  const today = todayISO();
  const [view, setView] = useState<View>(() => getState().prefs.timetableView);
  const [date, setDate] = useState(() => nextSchoolDay(todayISO()));
  const [mobileDay, setMobileDay] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ date: string; periodId: string } | null>(null);

  const isToday = date === today;
  const weekDates = useMemo(() => DAYS.map((_, i) => addDays(weekStart(date), i)), [date]);
  const nowPeriod = isToday ? currentPeriod(now) : null;
  const shownDay = view === 'week' ? (mobileDay && weekDates.includes(mobileDay) ? mobileDay : date) : date;

  const step = (n: number) => {
    let next = addDays(date, n);
    if (!dayOf(next)) next = addDays(next, n > 0 ? 1 : -1); // skip Sundays
    setDate(next);
    setMobileDay(null);
  };
  const stepWeek = (n: number) => { setDate(addDays(date, n * 7)); setMobileDay(null); };

  const lectureRows = PERIODS.filter((p) => p.kind === 'lecture').map((p) => ({ p, e: effectiveSlot(state, lib, shownDay, p.id) }));
  const scheduled = lectureRows.filter((r) => r.e.classIds.length).length;
  const available = lectureRows.filter((r) => r.e.source === 'none').length;
  const firstFree = PERIODS.find((p) => p.kind === 'lecture' && effectiveSlot(state, lib, date, p.id).source === 'none') ?? PERIODS.find((p) => p.kind === 'lecture')!;
  const openEditor = (d = date, periodId = firstFree.id) => setEdit({ date: d, periodId });

  const heading = view === 'week' ? 'Weekly Timetable' : isToday ? 'Today’s Timetable' : `${DAY_LABELS[dayOf(date) ?? 'mon'].long}’s Timetable`;
  const sub = view === 'week'
    ? `${formatDate(weekDates[0]!, { day: 'numeric', month: 'short' })} – ${formatDate(weekDates[5]!, { day: 'numeric', month: 'short' })} · ${LIBRARIES[lib].label}`
    : `${formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })} · ${scheduled} scheduled · ${available} available · ${LIBRARIES[lib].label}`;
  const notSchoolToday = view === 'today' && !dayOf(today) && date !== today;

  return (
    <Panel aria-labelledby="timetable-heading" className="flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-line px-4 py-4 sm:px-5">
        <div>
          <h2 id="timetable-heading" className="text-lg font-semibold text-ink">{heading}</h2>
          <p className="mt-0.5 text-[13px] text-muted">{sub}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Button size="sm" variant="secondary" aria-label={view === 'week' ? 'Previous week' : 'Previous day'} onClick={() => (view === 'week' ? stepWeek(-1) : step(-1))}><ChevronLeft className="size-4" aria-hidden /></Button>
            <Button size="sm" variant="secondary" onClick={() => { setDate(nextSchoolDay(today)); setMobileDay(null); }} disabled={date === nextSchoolDay(today)}>Today</Button>
            <Button size="sm" variant="secondary" aria-label={view === 'week' ? 'Next week' : 'Next day'} onClick={() => (view === 'week' ? stepWeek(1) : step(1))}><ChevronRight className="size-4" aria-hidden /></Button>
          </div>
          <SegmentedControl<View> label="Timetable view" value={view} onChange={setView} options={[{ value: 'today', label: 'Today' }, { value: 'week', label: 'Week' }]} />
          <Button icon={<Pencil className="size-4" aria-hidden />} onClick={() => openEditor()}>Edit</Button>
        </div>
      </div>

      {notSchoolToday && (
        <p className="border-b border-line bg-canvas px-4 py-2.5 text-[13px] text-muted sm:px-5">
          {formatDate(today, { weekday: 'long' })} isn’t a school day, so this shows {DAY_LABELS[dayOf(date)!].long}.
        </p>
      )}

      {view === 'today' && <DayRows rows={lectureRows} date={date} nowId={nowPeriod?.id ?? null} isToday={isToday} now={now} onEdit={(pid) => openEditor(date, pid)} onOpen={(c, pid) => navigate(`/class/${c}?date=${date}&slot=${pid}`)} />}

      {view === 'week' && (
        <>
          <div className="md:hidden">
            <div role="group" aria-label="Choose day" className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2">
              {weekDates.map((d) => (
                <button key={d} type="button" aria-pressed={d === shownDay} onClick={() => setMobileDay(d)} className={cn('h-9 min-w-14 shrink-0 rounded-control px-3 text-[13px] font-medium', d === shownDay ? 'bg-sage text-on-sage' : 'text-muted hover:bg-sage-soft')}>
                  {DAY_LABELS[dayOf(d)!].short}
                </button>
              ))}
            </div>
            <DayRows rows={lectureRows} date={shownDay} nowId={shownDay === today ? nowPeriod?.id ?? null : null} isToday={shownDay === today} now={now} onEdit={(pid) => openEditor(shownDay, pid)} onOpen={(c, pid) => navigate(`/class/${c}?date=${shownDay}&slot=${pid}`)} />
          </div>
          <div className="hidden md:block"><WeekGrid date={date} highlight={weekDates.includes(today) ? today : null} onEdit={(d, pid) => openEditor(d, pid)} /></div>
        </>
      )}

      <button type="button" onClick={() => openEditor()} className="flex h-12 w-full items-center justify-center gap-2 border-t border-line bg-primary text-sm font-medium text-white transition-colors hover:bg-primary-hover">
        <Plus className="size-4" aria-hidden />Add / Edit Timetable
      </button>

      {edit && <TimetableEditor open date={edit.date} periodId={edit.periodId} onClose={() => setEdit(null)} />}
    </Panel>
  );
}

function DayRows({ rows, date, nowId, isToday, now, onEdit, onOpen }: {
  rows: Array<{ p: (typeof PERIODS)[number]; e: ReturnType<typeof effectiveSlot> }>;
  date: string; nowId: string | null; isToday: boolean; now: Date;
  onEdit: (periodId: string) => void; onOpen: (classId: string, periodId: string) => void;
}) {
  const byId = new Map(rows.map((r) => [r.p.id, r.e]));
  if (!dayOf(date)) return <div className="px-5 py-12 text-center"><CalendarOff className="mx-auto size-7 text-muted" aria-hidden /><p className="mt-3 text-sm text-ink">No lectures on a Sunday.</p></div>;
  return (
    <table className="w-full border-collapse text-left text-sm">
      <thead>
        <tr className="border-b border-line text-[11px] font-medium tracking-[0.08em] text-muted uppercase">
          <th scope="col" className="px-4 py-2.5 font-medium sm:px-5">Lecture</th>
          <th scope="col" className="hidden w-60 border-l border-line px-4 py-2.5 font-medium sm:table-cell">Time</th>
          <th scope="col" className="border-l border-line px-4 py-2.5 font-medium">Class</th>
          <th scope="col" className="px-3 py-2.5 sm:px-5"><span className="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        {PERIODS.map((p) => {
          if (p.kind === 'break') {
            return (
              <tr key={p.id} className="border-b border-line bg-canvas text-muted">
                <th scope="row" className="px-4 py-1.5 text-xs font-medium sm:px-5">{p.label}<span className="block font-normal tabular-nums sm:hidden">{formatRange(p)}</span></th>
                <td className="hidden border-l border-line px-4 py-1.5 text-xs tabular-nums sm:table-cell">{formatRange(p)}</td>
                <td colSpan={2} className="border-l border-line px-4 py-1.5 text-xs">{nowId === p.id ? <Badge tone="green">Now</Badge> : '—'}</td>
              </tr>
            );
          }
          const e = byId.get(p.id)!;
          const tag = slotTag(e);
          const isNow = nowId === p.id;
          const past = isToday && !isNow && periodEnded(now, p);
          return (
            <tr key={p.id} className={cn('border-b border-line last:border-b-0', e.classIds.length > 0 && 'bg-sage-soft', e.source === 'cancelled' && 'bg-canvas', past && 'opacity-60')}>
              <th scope="row" className={cn('px-4 py-2.5 font-medium text-ink sm:px-5', isNow && 'border-l-[3px] border-l-primary pl-[13px] sm:pl-[17px]')}>
                {p.label}{p.tag && <span className="ml-1.5 text-[11px] font-normal text-muted">({p.tag})</span>}
                <span className="block text-xs font-normal text-muted tabular-nums sm:hidden">{formatRange(p)}</span>
              </th>
              <td className="hidden border-l border-line px-4 py-2.5 whitespace-nowrap text-muted tabular-nums sm:table-cell">{formatRange(p)}</td>
              <td className="border-l border-line px-4 py-2.5">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {e.source === 'cancelled' ? (
                    <span className="text-muted line-through">{shortClasses(e.regular)}</span>
                  ) : e.source === 'proxy' ? (
                    <span className="font-medium text-ink">{shortClasses(e.proxied)}</span>
                  ) : e.classIds.length ? (
                    <span className="font-medium text-ink">{shortClasses(e.classIds)}</span>
                  ) : (
                    <span className="text-muted">Available</span>
                  )}
                  {e.classIds.length > 1 && <Badge tone="amber">Combined</Badge>}
                  {tag && <Badge tone={tag.tone}>{tag.label}</Badge>}
                  {e.source === 'changed' && e.regular.length > 0 && <span className="text-xs text-muted">was {shortClasses(e.regular)}</span>}
                  {e.source === 'proxy' && <span className="text-xs text-muted">taken by {e.exception?.takenBy ?? 'someone else'}, not in the library</span>}
                  {e.exception?.note && <span className="text-xs text-muted">· {e.exception.note}</span>}
                  {isNow && <Badge tone="green">Now</Badge>}
                </span>
              </td>
              <td className="px-3 py-1.5 text-right sm:px-5">
                <span className="flex flex-wrap items-center justify-end gap-1">
                  {e.classIds.map((c) => (
                    <Button key={c} size="sm" variant="secondary" icon={<DoorOpen className="size-3.5" aria-hidden />} onClick={() => onOpen(c, p.id)} aria-label={`Open class ${c}, ${p.label}`}>
                      {e.classIds.length > 1 ? c : 'Open class'}
                    </Button>
                  ))}
                  <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" aria-hidden />} onClick={() => onEdit(p.id)} aria-label={`Edit ${p.label}`}><span className="hidden sm:inline">Edit</span></Button>
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
