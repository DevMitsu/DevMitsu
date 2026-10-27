import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Panel } from '../../components/ui/Panel';
import { PageHeader } from '../../components/ui/PageHeader';
import { notify } from '../../components/ui/toast';
import { bookById, borrowerName, borrowerPath, borrowerSub, fineOwed } from '../../domain/queries';
import { addDays, duesFor, formatDate, lateDays, rupees, todayISO } from '../../domain/rules';
import type { Fine } from '../../domain/types';
import { collectFine } from '../../store/actions';
import { useStore } from '../../store/store';
import { WaiveDialog } from './WaiveDialog';

export function FinesPage() {
  const state = useStore((s) => s);
  const today = todayISO();
  const [waive, setWaive] = useState<Fine | null>(null);

  const owed = useMemo(() => state.fines.filter((f) => fineOwed(f) > 0).sort((a, b) => a.createdOn.localeCompare(b.createdOn)), [state.fines]);
  const accruing = useMemo(() => state.loans.filter((l) => !l.returnedOn && lateDays(l.dueOn, today) > 0).map((l) => {
    const b = { type: l.borrowerType, id: l.borrowerId };
    const late = lateDays(l.dueOn, today);
    return { l, b, late, amount: late * duesFor(state, b).finePerDay };
  }).sort((a, b) => b.late - a.late), [state, today]);
  const month = addDays(today, -30);
  const recent = state.fines.filter((f) => fineOwed(f) === 0 && f.createdOn >= month);
  const stat = [
    { label: 'Owed', value: rupees(owed.reduce((n, f) => n + fineOwed(f), 0)) },
    { label: 'Building up on books still out', value: rupees(accruing.reduce((n, a) => n + a.amount, 0)) },
    { label: 'Collected, last 30 days', value: rupees(state.fines.filter((f) => f.createdOn >= month).reduce((n, f) => n + f.collected, 0)) },
    { label: 'Waived, last 30 days', value: rupees(state.fines.filter((f) => f.createdOn >= month).reduce((n, f) => n + f.waived, 0)) },
  ];
  return (
    <div>
      <PageHeader title="Fines" description="A fine starts after the loan period ends. Only the librarian can waive a fine, in full or in part, and a reason is kept." />
      <Panel className="mb-6"><dl className="grid grid-cols-2 lg:grid-cols-4">{stat.map((s, i) => <div key={s.label} className={`px-4 py-3.5 sm:px-5 ${i % 2 ? 'border-l border-line' : ''} ${i > 0 ? 'lg:border-l' : ''} ${i >= 2 ? 'border-t border-line lg:border-t-0' : ''}`}><dt className="text-[13px] text-muted">{s.label}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</dd></div>)}</dl></Panel>

      <h2 className="mb-2 text-base font-semibold">Fines owed ({owed.length})</h2>
      <Panel className="mb-8">
        {owed.length === 0 ? <p className="px-5 py-10 text-center text-sm text-muted">No fines are owed.</p> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm">
            <thead><tr className="border-b border-line text-[11px] tracking-[0.08em] text-muted uppercase"><th className="px-4 py-2.5 font-medium">Borrower</th><th className="px-3 py-2.5 font-medium">Book</th><th className="px-3 py-2.5 font-medium">Since</th><th className="px-3 py-2.5 text-right font-medium">Fine</th><th className="px-3 py-2.5 text-right font-medium">Waived</th><th className="px-3 py-2.5 text-right font-medium">Owed</th><th className="px-4 py-2.5"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{owed.map((f) => { const b = { type: f.borrowerType, id: f.borrowerId }; return (
              <tr key={f.id} className="border-b border-line last:border-b-0">
                <td className="px-4 py-2.5"><Link to={borrowerPath(b)} className="font-medium hover:text-primary hover:underline">{borrowerName(state, b)}</Link><span className="block text-xs text-muted">{borrowerSub(state, b)}</span></td>
                <td className="px-3 py-2.5">{bookById(state, f.bookId)?.title}</td><td className="px-3 py-2.5 text-muted">{formatDate(f.createdOn, { day: 'numeric', month: 'short' })}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{rupees(f.amount)}</td><td className="px-3 py-2.5 text-right tabular-nums">{rupees(f.waived)}</td><td className="px-3 py-2.5 text-right font-semibold tabular-nums">{rupees(fineOwed(f))}</td>
                <td className="px-4 py-2 text-right"><span className="flex justify-end gap-1"><Button size="sm" variant="primary" onClick={() => notify(collectFine(f.id))}>Collect</Button><Button size="sm" variant="secondary" onClick={() => setWaive(f)}>Waive</Button></span></td>
              </tr>); })}</tbody>
          </table></div>
        )}
      </Panel>

      <h2 className="mb-2 text-base font-semibold">Overdue now, fine building up ({accruing.length})</h2>
      <Panel className="mb-8">
        {accruing.length === 0 ? <p className="px-5 py-10 text-center text-sm text-muted">No book is overdue.</p> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm">
            <thead><tr className="border-b border-line text-[11px] tracking-[0.08em] text-muted uppercase"><th className="px-4 py-2.5 font-medium">Borrower</th><th className="px-3 py-2.5 font-medium">Book</th><th className="px-3 py-2.5 font-medium">Due</th><th className="px-3 py-2.5 text-right font-medium">Days late</th><th className="px-3 py-2.5 text-right font-medium">Fine so far</th><th className="px-4 py-2.5"><span className="sr-only">Open</span></th></tr></thead>
            <tbody>{accruing.slice(0, 25).map(({ l, b, late, amount }) => (
              <tr key={l.id} className="border-b border-line last:border-b-0">
                <td className="px-4 py-2.5"><span className="font-medium">{borrowerName(state, b)}</span><span className="block text-xs text-muted">{borrowerSub(state, b)}</span></td>
                <td className="px-3 py-2.5">{bookById(state, l.bookId)?.title}</td><td className="px-3 py-2.5 text-muted">{formatDate(l.dueOn, { day: 'numeric', month: 'short' })}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{late}</td><td className="px-3 py-2.5 text-right font-semibold tabular-nums">{rupees(amount)}</td>
                <td className="px-4 py-2 text-right"><Link to={`${borrowerPath(b)}?panel=1&ret=${l.id}`} className="text-[13px] font-medium text-primary underline underline-offset-2">Return</Link></td>
              </tr>))}</tbody>
          </table></div>
        )}
        {accruing.length > 25 && <p className="border-t border-line px-4 py-2.5 text-xs text-muted">Showing the 25 longest overdue of {accruing.length}. The full list is in Reports, under Circulation.</p>}
      </Panel>

      <h2 className="mb-2 text-base font-semibold">Settled in the last 30 days ({recent.length})</h2>
      <Panel>
        {recent.length === 0 ? <p className="px-5 py-10 text-center text-sm text-muted">Nothing settled recently.</p> : (
          <ul className="divide-y divide-line">{recent.slice(0, 12).map((f) => { const b = { type: f.borrowerType, id: f.borrowerId }; return (
            <li key={f.id} className="flex flex-wrap gap-x-4 px-4 py-2.5 text-sm"><span className="min-w-40 font-medium">{borrowerName(state, b)}</span><span className="flex-1 text-muted">{bookById(state, f.bookId)?.title}{f.waiveNote ? ` · waived: ${f.waiveNote}` : ''}</span><span className="tabular-nums">{rupees(f.collected)} paid{f.waived ? `, ${rupees(f.waived)} waived` : ''}</span></li>); })}</ul>
        )}
      </Panel>
      <WaiveDialog key={waive?.id} fine={waive} onClose={() => setWaive(null)} />
    </div>
  );
}
