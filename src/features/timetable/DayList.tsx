import { Pencil, Plus } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/cn';
import type { ClassGroup, DayId, SlotRef, TimetableData } from './types';
import { currentPeriodId, formatAssignment, formatRange, getAssignment, hasPeriodEnded } from './utils';

interface DayListProps {
  data: TimetableData;
  classes: ClassGroup[];
  day: DayId;
  /** Only set when `day` is the real current day, so past/in-progress states can be shown. */
  now?: Date;
  onEditSlot: (slot: SlotRef) => void;
}

/** One day as a structured table: period, time, class and section. */
export function DayList({ data, classes, day, now, onEditSlot }: DayListProps) {
  const nowId = now ? currentPeriodId(now, data.periods) : null;

  return (
    <table className="w-full border-collapse text-left text-sm">
      <thead>
        <tr className="border-b border-line text-[11px] font-medium tracking-[0.08em] text-muted uppercase">
          <th scope="col" className="px-4 py-2.5 font-medium sm:px-5">Period</th>
          <th scope="col" className="hidden w-40 border-l border-line px-4 py-2.5 font-medium sm:table-cell">Time</th>
          <th scope="col" className="border-l border-line px-4 py-2.5 font-medium">Class &amp; section</th>
          <th scope="col" className="w-24 px-4 py-2.5 sm:px-5"><span className="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        {data.periods.map((period) => {
          if (period.kind === 'break') {
            return (
              <tr key={period.id} className="border-b border-line bg-canvas text-muted">
                <th scope="row" className="px-4 py-2 text-[13px] font-medium sm:px-5">
                  {period.label}
                  <span className="block whitespace-nowrap font-normal sm:hidden">{formatRange(period)}</span>
                </th>
                <td className="hidden border-l border-line px-4 py-2 text-[13px] tabular-nums sm:table-cell">{formatRange(period)}</td>
                <td colSpan={2} className="border-l border-line px-4 py-2 text-[13px]">—</td>
              </tr>
            );
          }

          const slot: SlotRef = { day, periodId: period.id };
          const assignment = getAssignment(data, slot);
          const isNow = period.id === nowId;
          const past = !!now && !isNow && hasPeriodEnded(now, period);

          return (
            <tr
              key={period.id}
              className={cn(
                'border-b border-line last:border-b-0',
                assignment && 'bg-sage-soft',
                past && 'opacity-60',
              )}
            >
              <th
                scope="row"
                className={cn(
                  'px-4 py-3 font-medium text-ink sm:px-5',
                  isNow && 'border-l-[3px] border-l-primary pl-[13px] sm:pl-[17px]',
                )}
              >
                {period.label}
                <span className="block whitespace-nowrap text-[13px] font-normal text-muted tabular-nums sm:hidden">
                  {formatRange(period)}
                </span>
              </th>
              <td className="hidden border-l border-line px-4 py-3 text-muted tabular-nums sm:table-cell">
                {formatRange(period)}
              </td>
              <td className="border-l border-line px-4 py-3">
                {assignment ? (
                  <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="font-medium text-ink">{formatAssignment(assignment, classes)}</span>
                    {isNow && (
                      <span className="rounded-[4px] bg-primary px-1.5 py-0.5 text-[11px] font-medium text-white">
                        In progress
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-muted">
                    Available
                    {isNow && <span className="ml-2 text-[11px] font-medium text-primary">· Now</span>}
                  </span>
                )}
              </td>
              <td className="px-4 py-2 text-right sm:px-5">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={assignment ? <Pencil className="size-3.5" aria-hidden /> : <Plus className="size-3.5" aria-hidden />}
                  onClick={() => onEditSlot(slot)}
                  aria-label={`${assignment ? 'Edit' : 'Assign'} ${period.label}`}
                >
                  {assignment ? 'Edit' : 'Assign'}
                </Button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
