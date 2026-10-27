import { useMemo } from 'react';
import { Panel } from '../../components/ui/Panel';
import { fineOwed, effectiveSlot, unresolvedPending } from '../../domain/queries';
import { lateDays, nextSchoolDay, rupees, todayISO } from '../../domain/rules';
import { LECTURES } from '../../domain/schedule';
import { useStore } from '../../store/store';

export function TodaySummary() {
  const state = useStore((s) => s);
  const lib = state.activeLibrary;

  const stats = useMemo(() => {
    const today = todayISO();
    const open = state.loans.filter((l) => !l.returnedOn && state.books.find((b) => b.id === l.bookId)?.library === lib);
    const overdue = open.filter((l) => lateDays(l.dueOn, today) > 0).length;
    const owed = state.fines.reduce((n, f) => n + fineOwed(f), 0);
    const day = nextSchoolDay(today);
    const classes = LECTURES.reduce((n, p) => n + effectiveSlot(state, lib, day, p.id).classIds.length, 0);
    return [
      { label: 'Books on loan', value: String(open.length) },
      { label: 'Overdue books', value: String(overdue), attention: overdue > 0 },
      { label: 'Fines owed', value: rupees(owed), attention: owed > 0 },
      { label: 'Pending items', value: String(unresolvedPending(state).length) },
      { label: 'Classes today', value: String(classes) },
    ];
  }, [state, lib]);

  return (
    <section aria-labelledby="summary-heading">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 id="summary-heading" className="text-base font-semibold text-ink">Today’s Summary</h2>
        <p className="text-xs text-muted">Demo data</p>
      </div>
      <Panel>
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((s, i) => (
            <div key={s.label} className={`px-4 py-3.5 sm:px-5 ${i > 0 ? 'border-l border-line' : ''} ${i >= 2 ? 'border-t border-line lg:border-t-0' : ''} ${i === 2 ? 'sm:border-l-0 sm:border-t-0 sm:max-lg:border-l' : ''}`}>
              <dt className="flex items-center gap-1.5 text-[13px] text-muted">{s.attention && <span aria-hidden className="size-1.5 rounded-full bg-amber" />}{s.label}</dt>
              <dd className="mt-1 text-2xl font-semibold text-ink tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </section>
  );
}
