import { Link } from 'react-router-dom';
import { Panel } from '../../components/ui/Panel';
import { Badge } from '../../components/ui/Badge';
import { borrowerName, borrowerPath, borrowerSub, bookById, unresolvedPending } from '../../domain/queries';
import { diffDays, todayISO } from '../../domain/rules';
import { useStore } from '../../store/store';

export function PendingPanel() {
  const state = useStore((s) => s);
  const list = unresolvedPending(state).sort((a, b) => a.createdOn.localeCompare(b.createdOn));
  const today = todayISO();
  return (
    <section aria-labelledby="pending-heading">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 id="pending-heading" className="text-base font-semibold text-ink">Pending <span className="font-normal text-muted">({list.length})</span></h2>
        <Link to="/pending" className="text-[13px] font-medium text-primary underline underline-offset-2">See all</Link>
      </div>
      <Panel>
        {list.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">Nothing pending. Returns not submitted and issues to update will appear here.</p>
        ) : (
          <ul className="grid sm:grid-cols-2">
            {list.slice(0, 4).map((p) => {
              const b = { type: p.borrowerType, id: p.borrowerId };
              const age = diffDays(today, p.createdOn);
              const book = p.loanIds[0] ? bookById(state, state.loans.find((l) => l.id === p.loanIds[0])?.bookId ?? '')?.title : undefined;
              return (
                <li key={p.id} className="border-b border-line sm:odd:border-r sm:[&:nth-last-child(-n+2)]:border-b-0">
                  <Link to={borrowerPath(b)} className="flex items-center gap-3 px-4 py-3 hover:bg-sage-soft">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{borrowerName(state, b)}</span>
                      <span className="block truncate text-xs text-muted">{p.kind === 'return' ? `Return not submitted${book ? ` · ${book}` : ''}` : `Issue to update · ${p.text}`}</span>
                      <span className="block text-xs text-muted">{borrowerSub(state, b)}</span>
                    </span>
                    <Badge tone={age >= 5 ? 'amber' : 'neutral'}>{age === 0 ? 'Today' : `${age}d`}</Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </section>
  );
}
