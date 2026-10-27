import { useMemo } from 'react';
import { Panel } from '../../components/ui/Panel';
import { PageHeader } from '../../components/ui/PageHeader';
import { bookById, studentById } from '../../domain/queries';
import { addDays, diffDays, lateDays, LIBRARIES, todayISO } from '../../domain/rules';
import { useStore } from '../../store/store';

function Bars({ items }: { items: Array<[string, number]> }) {
  const max = Math.max(1, ...items.map((i) => i[1]));
  if (!items.length) return <p className="px-4 py-8 text-center text-sm text-muted">No loans in this period.</p>;
  return (
    <ul className="space-y-2.5 p-4">
      {items.map(([label, n]) => (
        <li key={label} className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-3 text-sm">
          <div><div className="mb-1 truncate text-[13px] text-ink">{label}</div><div className="h-2 rounded-[3px] bg-canvas"><div className="h-2 rounded-[3px] bg-primary" style={{ width: `${(n / max) * 100}%` }} /></div></div>
          <span className="text-right font-medium tabular-nums">{n}</span>
        </li>
      ))}
    </ul>
  );
}

export function StatsPage() {
  const state = useStore((s) => s);
  const today = todayISO();
  const d = useMemo(() => {
    const since = addDays(today, -30);
    const recent = state.loans.filter((l) => l.issuedOn >= since);
    const byBook = new Map<string, number>();
    const byClass = new Map<string, number>();
    recent.forEach((l) => {
      const t = bookById(state, l.bookId)?.title ?? '';
      byBook.set(t, (byBook.get(t) ?? 0) + 1);
      if (l.borrowerType === 'student') { const s = studentById(state, l.borrowerId); if (s) byClass.set(`Class ${s.grade}${s.section}`, (byClass.get(`Class ${s.grade}${s.section}`) ?? 0) + 1); }
    });
    const returned = state.loans.filter((l) => l.returnedOn && !l.lost);
    const avg = returned.length ? returned.reduce((n, l) => n + diffDays(l.returnedOn!, l.issuedOn), 0) / returned.length : 0;
    const out = state.loans.filter((l) => !l.returnedOn);
    return {
      issued: recent.length, returned: state.loans.filter((l) => l.returnedOn && l.returnedOn >= since).length, avg, out: out.length,
      overdue: out.filter((l) => lateDays(l.dueOn, today) > 0).length,
      top: [...byBook.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8), classes: [...byClass.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
      libs: (['jr', 'sr'] as const).map((l) => [LIBRARIES[l].label, recent.filter((x) => bookById(state, x.bookId)?.library === l).length] as [string, number]),
    };
  }, [state, today]);

  const cards = [['Issued, last 30 days', d.issued], ['Returned, last 30 days', d.returned], ['Books out now', d.out], ['Overdue now', d.overdue], ['Average days held', d.avg.toFixed(1)]];
  return (
    <div>
      <PageHeader title="Stats" description="A quick look at borrowing over the last 30 days. Demo data." />
      <Panel className="mb-6"><dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">{cards.map(([l, v], i) => <div key={l} className={`px-4 py-3.5 ${i ? 'lg:border-l lg:border-line' : ''} ${i % 2 ? 'border-l border-line sm:border-l-0 sm:max-lg:border-l' : ''}`}><dt className="text-[13px] text-muted">{l}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{v}</dd></div>)}</dl></Panel>
      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="top-books"><h2 id="top-books" className="mb-2 text-base font-semibold">Most borrowed books</h2><Panel><Bars items={d.top} /></Panel></section>
        <section aria-labelledby="top-classes"><h2 id="top-classes" className="mb-2 text-base font-semibold">Borrowing by class</h2><Panel><Bars items={d.classes} /></Panel></section>
        <section aria-labelledby="by-lib"><h2 id="by-lib" className="mb-2 text-base font-semibold">By library</h2><Panel><Bars items={d.libs} /></Panel></section>
      </div>
    </div>
  );
}
