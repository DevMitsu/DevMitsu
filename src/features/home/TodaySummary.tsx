import { mockSummary } from '../../data/mock/summary';
import { Panel } from '../../components/ui/Panel';

interface TodaySummaryProps {
  /** Derived from the live (in-memory) timetable, not mock data. */
  scheduledClasses: number | null;
}

export function TodaySummary({ scheduledClasses }: TodaySummaryProps) {
  const stats = [
    { label: 'Books on loan', value: mockSummary.booksOnLoan },
    { label: 'Overdue books', value: mockSummary.overdueBooks, attention: true },
    { label: 'Scheduled classes', value: scheduledClasses },
    { label: 'Attendance to review', value: mockSummary.attendanceAwaitingReview },
  ];

  return (
    <section aria-labelledby="summary-heading">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 id="summary-heading" className="text-base font-semibold text-ink">Today’s Summary</h2>
        <p className="text-xs text-muted">Illustrative figures</p>
      </div>
      <Panel>
        <dl className="grid grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className={[
                'px-4 py-3.5 sm:px-5',
                i % 2 === 1 ? 'border-l border-line' : '',
                i >= 2 ? 'border-t border-line lg:border-t-0' : '',
                i > 0 ? 'lg:border-l' : '',
              ].join(' ')}
            >
              <dt className="flex items-center gap-1.5 text-[13px] text-muted">
                {stat.attention && <span aria-hidden className="size-1.5 rounded-full bg-amber" />}
                {stat.label}
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-ink tabular-nums">{stat.value ?? '–'}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </section>
  );
}
