import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Panel } from '../../components/ui/Panel';
import { PageHeader } from '../../components/ui/PageHeader';
import { Select } from '../../components/ui/Select';
import { TextField } from '../../components/ui/Field';
import { notify } from '../../components/ui/toast';
import { bookById, borrowerName, borrowerPath, borrowerSub, studentById, unresolvedPending } from '../../domain/queries';
import { diffDays, formatDate, todayISO } from '../../domain/rules';
import { closePending } from '../../store/actions';
import { useStore } from '../../store/store';

export function PendingPage() {
  const state = useStore((s) => s);
  const navigate = useNavigate();
  const today = todayISO();
  const [kind, setKind] = useState('all');
  const [cls, setCls] = useState('all');
  const [closing, setClosing] = useState<{ id: string; note: string } | null>(null);

  const all = unresolvedPending(state).sort((a, b) => a.createdOn.localeCompare(b.createdOn));
  const classOf = (p: (typeof all)[number]) => (p.borrowerType === 'student' ? (() => { const s = studentById(state, p.borrowerId); return s ? `${s.grade}${s.section}` : ''; })() : 'Teachers');
  const classes = [...new Set(all.map(classOf))].sort();
  const list = all.filter((p) => (kind === 'all' || p.kind === kind) && (cls === 'all' || classOf(p) === cls));
  const resolved = state.pending.filter((p) => p.resolvedOn).sort((a, b) => b.resolvedOn!.localeCompare(a.resolvedOn!)).slice(0, 8);

  return (
    <div>
      <PageHeader title="Pending" description="Returns that were not submitted and issues waiting for their details. They stay here until resolved." />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Select label="Type" value={kind} onChange={(e) => setKind(e.target.value)} className="w-48"><option value="all">All types</option><option value="return">Return not submitted</option><option value="issue">Issue to update</option></Select>
        <Select label="Class" value={cls} onChange={(e) => setCls(e.target.value)} className="w-40"><option value="all">All classes</option>{classes.map((c) => <option key={c} value={c}>{c}</option>)}</Select>
        <p className="pb-2.5 text-sm text-muted">{list.length} of {all.length} shown</p>
      </div>
      <Panel>
        {list.length === 0 ? (
          <p className="px-5 py-14 text-center text-sm text-muted">{all.length ? 'No pending item matches these filters.' : 'Nothing is pending. Choose “Not submitted / will update” in Issue / Return to park an item here.'}</p>
        ) : (
          <ul className="divide-y divide-line">
            {list.map((p) => {
              const b = { type: p.borrowerType, id: p.borrowerId };
              const age = diffDays(today, p.createdOn);
              const books = p.loanIds.map((lid) => bookById(state, state.loans.find((l) => l.id === lid)?.bookId ?? '')?.title).filter(Boolean);
              return (
                <li key={p.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm"><Link to={borrowerPath(b)} className="font-medium text-ink hover:text-accent hover:underline">{borrowerName(state, b)}</Link><span className="text-muted"> · {borrowerSub(state, b)}</span></p>
                      <p className="mt-0.5 text-[13px] text-ink">{p.kind === 'return' ? 'Return not submitted' : 'Issue to update'}<span className="text-muted"> · {p.kind === 'return' ? books.join(', ') : p.text}</span></p>
                      <p className="text-xs text-muted">Since {formatDate(p.createdOn, { day: 'numeric', month: 'short' })}</p>
                    </div>
                    <Badge tone={age >= 5 ? 'amber' : 'neutral'}>{age === 0 ? 'Today' : `${age} day${age > 1 ? 's' : ''}`}</Badge>
                    <Button size="sm" variant="primary" onClick={() => navigate(`${borrowerPath(b)}?panel=1&resolve=${p.id}${p.kind === 'return' ? `&ret=${p.loanIds.join(',')}` : `&issueText=${encodeURIComponent('')}`}`)}>Resolve</Button>
                    <Button size="sm" variant="secondary" onClick={() => setClosing({ id: p.id, note: '' })}>Close with note</Button>
                  </div>
                  {closing?.id === p.id && (
                    <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (notify(closePending(p.id, closing.note))) setClosing(null); }}>
                      <TextField className="min-w-60 flex-1" label="Why is this being closed?" value={closing.note} onChange={(v) => setClosing({ id: p.id, note: v })} autoFocus />
                      <Button type="submit" variant="primary">Close item</Button><Button onClick={() => setClosing(null)}>Cancel</Button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
      {resolved.length > 0 && (
        <section className="mt-8" aria-labelledby="recent-resolved">
          <h2 id="recent-resolved" className="mb-2 text-base font-semibold text-ink">Recently resolved</h2>
          <Panel><ul className="divide-y divide-line">{resolved.map((p) => <li key={p.id} className="flex flex-wrap gap-x-3 px-4 py-2.5 text-sm"><span className="font-medium">{borrowerName(state, { type: p.borrowerType, id: p.borrowerId })}</span><span className="text-muted">{p.kind === 'return' ? 'Return' : 'Issue'} · {p.resolvedNote} · {formatDate(p.resolvedOn!, { day: 'numeric', month: 'short' })}</span></li>)}</ul></Panel>
        </section>
      )}
    </div>
  );
}
