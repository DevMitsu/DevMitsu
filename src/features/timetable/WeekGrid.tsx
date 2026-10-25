import { cn } from '../../lib/cn';
import type { ClassGroup, DayId, SlotRef, TimetableData } from './types';
import { DAY_LABELS, formatAssignment, formatRange, getAssignment } from './utils';

interface WeekGridProps {
  data: TimetableData;
  classes: ClassGroup[];
  highlightDay?: DayId | null;
  onEditSlot: (slot: SlotRef) => void;
  /** Smaller cells for use inside the editor. */
  compact?: boolean;
  selected?: SlotRef;
}

/** Days across, periods down. Every teaching cell opens the editor for that slot. */
export function WeekGrid({ data, classes, highlightDay, onEditSlot, compact, selected }: WeekGridProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="w-36 px-4 py-2.5 text-left text-[11px] font-medium tracking-[0.08em] text-muted uppercase">
              Period
            </th>
            {data.days.map((day) => (
              <th
                key={day}
                scope="col"
                className={cn(
                  'border-l border-line px-2 py-2.5 text-center text-[13px] font-medium',
                  highlightDay === day ? 'bg-sage text-navy' : 'text-ink',
                )}
              >
                {DAY_LABELS[day].short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.periods.map((period) =>
            period.kind === 'break' ? (
              <tr key={period.id} className="border-b border-line bg-canvas text-muted">
                <th scope="row" className="px-4 py-1.5 text-left text-[13px] font-medium">
                  {period.label}
                </th>
                <td colSpan={data.days.length} className="border-l border-line px-3 py-1.5 text-[13px] tabular-nums">
                  {formatRange(period)}
                </td>
              </tr>
            ) : (
              <tr key={period.id} className="border-b border-line last:border-b-0">
                <th scope="row" className="px-4 py-2 text-left font-medium text-ink">
                  {period.label}
                  <span className="block text-xs font-normal text-muted tabular-nums">{formatRange(period)}</span>
                </th>
                {data.days.map((day) => {
                  const slot: SlotRef = { day, periodId: period.id };
                  const assignment = getAssignment(data, slot);
                  const isSelected = selected?.day === day && selected.periodId === period.id;
                  const label = assignment ? formatAssignment(assignment, classes, 'short') : 'Free';
                  return (
                    <td
                      key={day}
                      className={cn('border-l border-line p-0', highlightDay === day && 'bg-sage-soft/60')}
                    >
                      <button
                        type="button"
                        onClick={() => onEditSlot(slot)}
                        aria-label={`${DAY_LABELS[day].long}, ${period.label}: ${
                          assignment ? formatAssignment(assignment, classes) : 'available'
                        }`}
                        aria-pressed={selected ? isSelected : undefined}
                        className={cn(
                          'flex w-full items-center justify-center px-2 transition-colors',
                          compact ? 'h-10' : 'h-12',
                          assignment
                            ? 'bg-sage font-medium text-navy hover:bg-primary hover:text-white'
                            : 'text-muted hover:bg-sage-soft hover:text-ink',
                          isSelected && 'outline-2 -outline-offset-2 outline-primary',
                        )}
                      >
                        {label}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}
