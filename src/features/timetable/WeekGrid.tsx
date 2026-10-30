import { addDays, dayOf, fromISO } from '../../domain/rules';
import { effectiveSlot } from '../../domain/queries';
import { DAYS, DAY_LABELS, PERIODS, formatRange } from '../../domain/schedule';
import { cn } from '../../lib/cn';
import { useStore } from '../../store/store';
import { shortClasses } from './labels';

/** Monday of the week containing the date. */
export function weekStart(iso: string): string {
  const d = fromISO(iso).getDay();
  return addDays(iso, d === 0 ? -6 : 1 - d);
}

/** Days across, lectures down, for the week containing `date`. Every lecture cell opens the editor. */
export function WeekGrid({ date, highlight, onEdit }: { date: string; highlight?: string | null; onEdit: (date: string, periodId: string) => void }) {
  const state = useStore((s) => s);
  const lib = state.activeLibrary;
  const start = weekStart(date);
  const dates = DAYS.map((_, i) => addDays(start, i));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="w-40 px-4 py-2.5 text-left text-[11px] font-medium tracking-[0.08em] text-muted uppercase">Lecture</th>
            {dates.map((d) => (
              <th key={d} scope="col" className={cn('border-l border-line px-2 py-2.5 text-center text-[13px] font-medium', d === highlight ? 'bg-sage text-on-sage' : 'text-ink')}>
                {DAY_LABELS[dayOf(d)!].short}
                <span className="block text-[11px] font-normal text-muted">{fromISO(d).getDate()}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERIODS.map((p) =>
            p.kind === 'break' ? (
              <tr key={p.id} className="border-b border-line bg-canvas text-muted">
                <th scope="row" className="px-4 py-1.5 text-left text-xs font-medium">{p.label}</th>
                <td colSpan={dates.length} className="border-l border-line px-3 py-1.5 text-xs tabular-nums">{formatRange(p)}</td>
              </tr>
            ) : (
              <tr key={p.id} className="border-b border-line last:border-b-0">
                <th scope="row" className="px-4 py-1.5 text-left font-medium text-ink">
                  {p.label}{p.tag && <span className="ml-1.5 text-[11px] font-normal text-muted">({p.tag})</span>}
                  <span className="block text-xs font-normal text-muted tabular-nums">{formatRange(p)}</span>
                </th>
                {dates.map((d) => {
                  const e = effectiveSlot(state, lib, d, p.id);
                  const changed = e.source !== 'regular' && e.source !== 'none';
                  return (
                    <td key={d} className={cn('border-l border-line p-0', d === highlight && 'bg-sage-soft/60')}>
                      <button
                        type="button"
                        onClick={() => onEdit(d, p.id)}
                        aria-label={`${DAY_LABELS[dayOf(d)!].long} ${p.label}: ${e.source === 'cancelled' ? 'cancelled' : e.source === 'proxy' ? `${shortClasses(e.proxied)} taken by ${e.exception?.takenBy ?? 'someone else'} (proxy)` : e.classIds.length ? shortClasses(e.classIds) : 'available'}`}
                        className={cn(
                          'relative flex h-12 w-full items-center justify-center px-1.5 text-[13px] transition-colors',
                          e.classIds.length ? 'bg-sage font-medium text-on-sage hover:bg-primary hover:text-white' : 'text-muted hover:bg-sage-soft hover:text-ink',
                          (e.source === 'cancelled' || e.source === 'proxy') && 'bg-canvas text-muted hover:bg-sage-soft hover:text-ink',
                          e.source === 'cancelled' && 'line-through',
                        )}
                      >
                        {e.source === 'cancelled' ? shortClasses(e.regular) : e.source === 'proxy' ? `${shortClasses(e.proxied)} · proxy` : e.classIds.length ? shortClasses(e.classIds) : 'Free'}
                        {changed && <span aria-hidden className="absolute top-1 right-1 size-1.5 rounded-full bg-amber" />}
                        {e.classIds.length > 1 && <span aria-hidden className="absolute bottom-0.5 text-[9px] font-semibold tracking-wide uppercase opacity-70">Combined</span>}
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
