import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleCheck, HandCoins } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Field';
import { Panel } from '../../components/ui/Panel';
import { PageHeader } from '../../components/ui/PageHeader';
import { Tabs } from '../../components/ui/Tabs';
import { notify } from '../../components/ui/toast';
import { bookById, borrowerName, borrowerPath, borrowerSub, fineOwed } from '../../domain/queries';
import { addDays, duesFor, formatDate, lateDays, rupees, todayISO } from '../../domain/rules';
import type { Fine } from '../../domain/types';
import { collectFine } from '../../store/actions';
import { useStore } from '../../store/store';
import { WaiveDialog } from './WaiveDialog';

type Tab = 'collect' | 'overdue' | 'history';

export function FinesPage() {
  const state = useStore((s) => s);
  const today = todayISO();
  const rule = state.settings.studentDues;
  const [tab, setTab] = useState<Tab>('collect');
  const [waive, setWaive] = useState<Fine | null>(null);
  const [onlyWaived, setOnlyWaived] = useState(false);

  const toCollect = useMemo(() => state.fines.filter((f) => fineOwed(f) > 0).sort((a, b) => a.createdOn.localeCompare(b.createdOn)), [state.fines]);
  const overdue = useMemo(() => state.loans.filter((l) => !l.returnedOn && lateDays(l.dueOn, today) > 0).map((l) => {
    const b = { type: l.borrowerType, id: l.borrowerId };
    const late = lateDays(l.dueOn, today);
    return { l, b, late, amount: late * duesFor(state, b).finePerDay };
  }).sort((a, b) => b.late - a.late), [state, today]);
  const since = addDays(today, -30);
  const history = useMemo(() => state.fines.filter((f) => fineOwed(f) === 0).sort((a, b) => b.createdOn.localeCompare(a.createdOn)), [state.fines]);
  const shownHistory = history.filter((f) => !onlyWaived || f.waived > 0);
  const recent = state.fines.filter((f) => f.createdOn >= since);

  const stats = [
    { label: 'To collect now', value: rupees(toCollect.reduce((n, f) => n + fineOwed(f), 0)), sub: `${toCollect.length} fine${toCollect.length === 1 ? '' : 's'}`, tone: toCollect.length > 0 },
    { label: 'Still growing', value: rupees(overdue.reduce((n, a) => n + a.amount, 0)), sub: `${overdue.length} overdue book${overdue.length === 1 ? '' : 's'}`, tone: false },
    { label: 'Collected, 30 days', value: rupees(recent.reduce((n, f) => n + f.collected, 0)), sub: 'paid by students', tone: false },
    { label: 'Waived, 30 days', value: rupees(recent.reduce((n, f) => n + f.waived, 0)), sub: 'not charged', tone: false },
  ];
  const daysText = (f: Fine) => {
    const d = f.days ?? (rule.finePerDay ? Math.round(f.amount / rule.finePerDay) : 0);
    return d ? `${d} day${d === 1 ? '' : 's'} late × ${rupees(rule.finePerDay)}` : 'Late return';
  };

  return (
    <div>
      <PageHeader title="Fines" description={`A book is due ${rule.loanDays} days after it is issued. After that, each late day costs ${rupees(rule.finePerDay)}. The fine is worked out when the book comes back.`} />

      <dl className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Panel key={s.label} className="px-4 py-3.5">
            <dt className="text-[13px] text-muted">{s.label}</dt>
            <dd className="mt-1 flex items-baseline gap-2"><span className="text-2xl font-semibold tabular-nums">{s.value}</span></dd>
            <p className="mt-0.5 text-xs text-muted">{s.tone && <span aria-hidden className="mr-1 inline-block size-1.5 rounded-full bg-amber align-middle" />}{s.sub}</p>
          </Panel>
        ))}
      </dl>

      <Tabs<Tab> label="Fines" value={tab} onChange={setTab} tabs={[
        { value: 'collect', label: 'To collect', count: toCollect.length },
        { value: 'overdue', label: 'Overdue books', count: overdue.length },
        { value: 'history', label: 'Paid and waived', count: history.length },
      ]} />

      <div className="mt-4">
        {tab === 'collect' && (toCollect.length === 0 ? (
          <Panel className="px-5 py-14 text-center"><CircleCheck className="mx-auto size-8 text-accent" aria-hidden /><p className="mt-3 text-sm font-medium">Nothing to collect.</p><p className="mt-1 text-sm text-muted">Fines left unpaid at return will appear here.</p></Panel>
        ) : (
          <ul className="space-y-3">
            {toCollect.map((f) => {
              const b = { type: f.borrowerType, id: f.borrowerId };
              return (
                <li key={f.id}>
                  <Panel className="flex flex-wrap items-center gap-4 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm"><Link to={borrowerPath(b)} className="font-semibold text-ink hover:text-accent hover:underline">{borrowerName(state, b)}</Link><span className="text-muted"> · {borrowerSub(state, b)}</span></p>
                      <p className="mt-0.5 text-sm text-ink">{bookById(state, f.bookId)?.title}</p>
                      <p className="mt-1 text-xs text-muted">{daysText(f)} = {rupees(f.amount)}{f.waived > 0 && ` · ${rupees(f.waived)} already waived`}{f.collected > 0 && ` · ${rupees(f.collected)} already paid`} · returned {formatDate(f.createdOn, { day: 'numeric', month: 'short' })}</p>
                    </div>
                    <div className="text-right"><p className="text-xs text-muted">To collect</p><p className="text-2xl font-semibold tabular-nums">{rupees(fineOwed(f))}</p></div>
                    <div className="flex gap-2">
                      <Button variant="primary" icon={<HandCoins className="size-4" aria-hidden />} onClick={() => notify(collectFine(f.id))}>Collect {rupees(fineOwed(f))}</Button>
                      <Button onClick={() => setWaive(f)}>Waive…</Button>
                    </div>
                  </Panel>
                </li>
              );
            })}
          </ul>
        ))}

        {tab === 'overdue' && (
          <>
            <p className="mb-3 text-sm text-muted">These books have not come back. The fine below is what it would be if returned today. It is not charged until the book is returned.</p>
            {overdue.length === 0 ? <Panel className="px-5 py-14 text-center text-sm text-muted">No book is overdue.</Panel> : (
              <ul className="space-y-3">
                {overdue.slice(0, 40).map(({ l, b, late, amount }) => (
                  <li key={l.id}>
                    <Panel className="flex flex-wrap items-center gap-4 p-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm"><Link to={borrowerPath(b)} className="font-semibold text-ink hover:text-accent hover:underline">{borrowerName(state, b)}</Link><span className="text-muted"> · {borrowerSub(state, b)}</span></p>
                        <p className="mt-0.5 text-sm text-ink">{bookById(state, l.bookId)?.title}</p>
                        <p className="mt-1 text-xs text-muted">Due {formatDate(l.dueOn, { day: 'numeric', month: 'short' })} · {late} day{late === 1 ? '' : 's'} late</p>
                      </div>
                      <div className="text-right"><p className="text-xs text-muted">Fine if returned today</p><p className="text-xl font-semibold tabular-nums">{rupees(amount)}</p></div>
                      <Link to={`${borrowerPath(b)}?panel=1&ret=${l.id}`} className="inline-flex h-10 items-center rounded-control border border-line bg-panel px-4 text-sm font-medium hover:bg-sage-soft">Return this book</Link>
                    </Panel>
                  </li>
                ))}
              </ul>
            )}
            {overdue.length > 40 && <p className="mt-3 text-xs text-muted">Showing the 40 longest overdue of {overdue.length}. The full list is in Reports, under Circulation.</p>}
          </>
        )}

        {tab === 'history' && (
          <>
            <div className="mb-3"><Checkbox checked={onlyWaived} onChange={setOnlyWaived} label="Show only fines that were waived" /></div>
            <Panel>
              {shownHistory.length === 0 ? <p className="px-5 py-12 text-center text-sm text-muted">Nothing to show.</p> : (
                <ul className="divide-y divide-line">
                  {shownHistory.slice(0, 40).map((f) => {
                    const b = { type: f.borrowerType, id: f.borrowerId };
                    return (
                      <li key={f.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                        <div className="min-w-0 flex-1"><p className="font-medium">{borrowerName(state, b)} <span className="font-normal text-muted">· {bookById(state, f.bookId)?.title}</span></p>
                          {f.waived > 0 && <p className="text-xs text-muted">Waived {rupees(f.waived)}{f.waiveNote ? `: ${f.waiveNote}` : ''}</p>}</div>
                        <span className="text-xs text-muted">{formatDate(f.createdOn, { day: 'numeric', month: 'short' })}</span>
                        {f.collected > 0 && <Badge tone="sage">Paid {rupees(f.collected)}</Badge>}
                        {f.waived > 0 && <Badge tone="amber">Waived {rupees(f.waived)}</Badge>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </>
        )}
      </div>
      <WaiveDialog key={waive?.id} fine={waive} onClose={() => setWaive(null)} />
    </div>
  );
}
