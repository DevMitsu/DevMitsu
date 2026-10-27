import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowLeftRight, Pencil, RefreshCw } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Panel } from '../../components/ui/Panel';
import { Tabs } from '../../components/ui/Tabs';
import { TextField } from '../../components/ui/Field';
import { notify } from '../../components/ui/toast';
import { bookById, fineOwed, openLoansOf, pendingOf } from '../../domain/queries';
import { diffDays, duesFor, formatDate, LIBRARIES, lateDays, libraryForGrade, rupees, todayISO } from '../../domain/rules';
import type { Borrower, BorrowerType, Fine } from '../../domain/types';
import { closePending, collectFine, renewLoan } from '../../store/actions';
import { useStore } from '../../store/store';
import { usePageTitle } from '../../lib/usePageTitle';
import { StudentDialog, TeacherDialog } from '../people/PersonDialogs';
import { WaiveDialog } from '../fines/WaiveDialog';
import { IssueReturnPanel } from './IssueReturnPanel';
import { cn } from '../../lib/cn';

type Tab = 'issued' | 'pending' | 'fines' | 'history';
interface PanelInit { ret: string[]; resolve: string[]; issueText?: string }

export function BorrowerFile({ type }: { type: BorrowerType }) {
  const { id = '' } = useParams();
  const [sp, setSp] = useSearchParams();
  const state = useStore((s) => s);
  const borrower: Borrower = { type, id };
  const student = type === 'student' ? state.students.find((s) => s.id === id) : undefined;
  const teacher = type === 'teacher' ? state.teachers.find((t) => t.id === id) : undefined;
  const person = student ?? teacher;
  const today = todayISO();

  const [tab, setTab] = useState<Tab>('issued');
  const [panel, setPanel] = useState<PanelInit | null>(() => (sp.get('panel') ? { ret: (sp.get('ret') ?? '').split(',').filter(Boolean), resolve: (sp.get('resolve') ?? '').split(',').filter(Boolean), issueText: sp.get('issueText') ?? undefined } : null));
  const [editing, setEditing] = useState(false);
  const [waive, setWaive] = useState<Fine | null>(null);
  const [closing, setClosing] = useState<{ id: string; note: string } | null>(null);
  usePageTitle(person?.name ?? 'Not found');

  useEffect(() => { if (sp.get('panel')) setSp({}, { replace: true }); }, []); // eslint-disable-line

  const loans = useMemo(() => openLoansOf(state, borrower), [state, id, type]); // eslint-disable-line
  const pend = pendingOf(state, borrower);
  const fines = state.fines.filter((f) => f.borrowerType === type && f.borrowerId === id).sort((a, b) => b.createdOn.localeCompare(a.createdOn));
  const history = state.loans.filter((l) => l.borrowerType === type && l.borrowerId === id && l.returnedOn).sort((a, b) => b.returnedOn!.localeCompare(a.returnedOn!));

  if (!person) {
    return <Panel className="px-6 py-14 text-center"><p className="font-semibold">Not found</p><p className="mt-1 text-sm text-muted">This record doesn’t exist.</p><Link to="/students" className="mt-4 inline-block text-sm font-medium text-primary underline">Back to Students</Link></Panel>;
  }
  const dues = duesFor(state, borrower);
  const accruing = loans.reduce((n, l) => n + lateDays(l.dueOn, today) * dues.finePerDay, 0);
  const owed = fines.reduce((n, f) => n + fineOwed(f), 0);
  const home = student ? libraryForGrade(student.grade) : null;
  const backTo = student ? `/class/${student.grade}${student.section}` : '/students?tab=teachers';

  return (
    <div>
      <Link to={backTo} className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"><ArrowLeft className="size-4" aria-hidden />{student ? `Class ${student.grade}${student.section}` : 'Teachers'}</Link>
      <Panel className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-ink">{person.name}</h1>
              {home && <Badge>{LIBRARIES[home].label}</Badge>}
              {!person.active && <Badge tone="amber">{type === 'student' ? 'Left school' : 'Inactive'}</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted">
              {student ? `Class ${student.grade}${student.section} · GR no. ${student.grNo}` : `Teacher · ${teacher!.department}`}
            </p>
            <p className="mt-3 text-sm text-ink">
              Holding <span className="font-semibold">{loans.length}</span> of {dues.maxBooks} books
              {accruing > 0 && <> · <span className="font-semibold">{rupees(accruing)}</span> fine building up</>}
              {owed > 0 && <> · <span className="font-semibold">{rupees(owed)}</span> owed</>}
            </p>
            {teacher && <p className="mt-1 text-xs text-muted">Teacher dues: {dues.loanDays} days, {rupees(dues.finePerDay)}/day late, up to {dues.maxBooks} books. <Link to="/misc" className="text-primary underline">Change in Miscellaneous</Link></p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button icon={<Pencil className="size-4" aria-hidden />} onClick={() => setEditing(true)}>Edit</Button>
            <Button variant="primary" size="md" icon={<ArrowLeftRight className="size-4" aria-hidden />} onClick={() => setPanel({ ret: [], resolve: [] })} disabled={!person.active}>Issue / Return</Button>
          </div>
        </div>
      </Panel>

      <Tabs<Tab> label="Sections" value={tab} onChange={setTab} tabs={[
        { value: 'issued', label: 'Currently issued', count: loans.length },
        { value: 'pending', label: 'Pending', count: pend.length },
        { value: 'fines', label: 'Fines', count: fines.filter((f) => fineOwed(f) > 0).length },
        { value: 'history', label: 'History', count: history.length },
      ]} />

      <Panel className="mt-4">
        {tab === 'issued' && (loans.length === 0 ? <Empty text="No books issued right now." /> : (
          <ul className="divide-y divide-line">
            {loans.map((l) => {
              const b = bookById(state, l.bookId)!;
              const late = lateDays(l.dueOn, today);
              const left = diffDays(l.dueOn, today);
              return (
                <li key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">{b.title}</p>
                    <p className="text-xs text-muted">#{b.accession} · {LIBRARIES[b.library].label} · issued {formatDate(l.issuedOn, { day: 'numeric', month: 'short' })} · due {formatDate(l.dueOn, { day: 'numeric', month: 'short' })}{l.renewals ? ` · renewed ${l.renewals}×` : ''}</p>
                    {l.crossNote && <p className="mt-0.5 text-xs text-muted">Cross-library: {l.crossNote}</p>}
                  </div>
                  {late > 0 ? <Badge tone="amber">{late} day{late > 1 ? 's' : ''} late · {rupees(late * dues.finePerDay)}</Badge> : <Badge tone="sage">{left === 0 ? 'Due today' : `${left} days left`}</Badge>}
                  <Button size="sm" variant="secondary" icon={<RefreshCw className="size-3.5" aria-hidden />} disabled={late > 0} title={late > 0 ? 'Overdue: return it first' : undefined} onClick={() => notify(renewLoan(l.id))}>Renew</Button>
                  <Button size="sm" variant="secondary" onClick={() => setPanel({ ret: [l.id], resolve: [] })}>Return</Button>
                </li>
              );
            })}
          </ul>
        ))}

        {tab === 'pending' && (pend.length === 0 ? <Empty text="Nothing pending for this person." /> : (
          <ul className="divide-y divide-line">
            {pend.map((p) => (
              <li key={p.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">{p.kind === 'return' ? 'Return not submitted' : 'Issue to update'}</p>
                    <p className="text-xs text-muted">{p.kind === 'return' ? p.loanIds.map((lid) => bookById(state, state.loans.find((l) => l.id === lid)?.bookId ?? '')?.title).filter(Boolean).join(', ') : p.text} · since {formatDate(p.createdOn, { day: 'numeric', month: 'short' })}</p>
                  </div>
                  <Button size="sm" variant="primary" onClick={() => setPanel({ ret: p.kind === 'return' ? p.loanIds : [], resolve: [p.id] })}>Resolve</Button>
                  <Button size="sm" variant="secondary" onClick={() => setClosing({ id: p.id, note: '' })}>Close with note</Button>
                </div>
                {closing?.id === p.id && (
                  <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (notify(closePending(p.id, closing.note))) setClosing(null); }}>
                    <TextField className="min-w-60 flex-1" label="Why is this being closed?" value={closing.note} onChange={(v) => setClosing({ id: p.id, note: v })} autoFocus />
                    <Button type="submit" variant="primary">Close item</Button>
                    <Button onClick={() => setClosing(null)}>Cancel</Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        ))}

        {tab === 'fines' && (fines.length === 0 ? <Empty text="No fines on record." /> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm">
            <thead><tr className="border-b border-line text-[11px] tracking-[0.08em] text-muted uppercase"><th className="px-4 py-2.5 font-medium">Book</th><th className="px-3 py-2.5 font-medium">Date</th><th className="px-3 py-2.5 text-right font-medium">Fine</th><th className="px-3 py-2.5 text-right font-medium">Waived</th><th className="px-3 py-2.5 text-right font-medium">Paid</th><th className="px-3 py-2.5 text-right font-medium">Owed</th><th className="px-4 py-2.5"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{fines.map((f) => (
              <tr key={f.id} className="border-b border-line last:border-b-0">
                <td className="px-4 py-2.5">{bookById(state, f.bookId)?.title}{f.waiveNote && <span className="block text-xs text-muted">Waiver: {f.waiveNote}</span>}</td>
                <td className="px-3 py-2.5 text-muted">{formatDate(f.createdOn, { day: 'numeric', month: 'short' })}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{rupees(f.amount)}</td><td className="px-3 py-2.5 text-right tabular-nums">{rupees(f.waived)}</td><td className="px-3 py-2.5 text-right tabular-nums">{rupees(f.collected)}</td>
                <td className={cn('px-3 py-2.5 text-right font-semibold tabular-nums', fineOwed(f) > 0 && 'text-ink')}>{rupees(fineOwed(f))}</td>
                <td className="px-4 py-2 text-right">{fineOwed(f) > 0 && <span className="flex justify-end gap-1"><Button size="sm" variant="secondary" onClick={() => notify(collectFine(f.id))}>Collect</Button><Button size="sm" variant="ghost" onClick={() => setWaive(f)}>Waive</Button></span>}</td>
              </tr>))}</tbody>
          </table></div>
        ))}

        {tab === 'history' && (history.length === 0 ? <Empty text="No past loans yet." /> : (
          <ul className="divide-y divide-line">
            {history.slice(0, 40).map((l) => {
              const b = bookById(state, l.bookId);
              return (
                <li key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1"><p className="text-sm font-medium text-ink">{b?.title}</p><p className="text-xs text-muted">#{b?.accession} · {formatDate(l.issuedOn, { day: 'numeric', month: 'short' })} → {formatDate(l.returnedOn!, { day: 'numeric', month: 'short' })}</p></div>
                  {l.lost ? <Badge tone="amber">Lost · {l.lost.outcome}</Badge> : <Badge tone="neutral">Returned</Badge>}
                </li>
              );
            })}
          </ul>
        ))}
      </Panel>

      {panel && <IssueReturnPanel open borrower={borrower} preselectReturn={panel.ret} resolvePendingIds={panel.resolve} issueParkedText={panel.issueText} onClose={() => setPanel(null)} />}
      {editing && student && <StudentDialog open student={student} onClose={() => setEditing(false)} />}
      {editing && teacher && <TeacherDialog open teacher={teacher} onClose={() => setEditing(false)} />}
      <WaiveDialog key={waive?.id} fine={waive} onClose={() => setWaive(null)} />
    </div>
  );
}

const Empty = ({ text }: { text: string }) => <p className="px-4 py-10 text-center text-sm text-muted">{text}</p>;
