import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, Badge, Card, PageHeader, cx } from '../../components/ui';
import { ALERT_LABEL, type AlertKind } from '../../domain/alerts';
import { ALL } from '../../domain/inventory';
import { useAlerts } from '../../lib/alerts';
import { scopePath, useScope } from '../../lib/scope';
import { useStore } from '../../store/store';

export function AlertsPage() {
  const { scope, lab } = useScope();
  const alerts = useAlerts(scope);
  const labs = useStore((s) => s.labs);
  const [kind, setKind] = useState<AlertKind | ''>('');
  const kinds = useMemo(() => {
    const m = new Map<AlertKind, number>();
    alerts.forEach((a) => m.set(a.kind, (m.get(a.kind) ?? 0) + 1));
    return [...m.entries()];
  }, [alerts]);
  const shown = kind ? alerts.filter((a) => a.kind === kind) : alerts;

  return (
    <div>
      <PageHeader icon="siren" title={`Alerts${lab ? ` · ${lab.name}` : ''}`} sub="Everything that needs someone to do something: low stock, expiry, overdue loans and services, open accidents, unsafe storage. The thresholds are under Customise → Alerts & rules." />
      {alerts.length === 0 ? (
        <Card><EmptyState icon="shield" title="All clear">Nothing is low, expired, overdue or unsafe right now.</EmptyState></Card>
      ) : (
        <>
          <div className="no-print mb-3 flex flex-wrap gap-1.5">
            <button onClick={() => setKind('')} aria-pressed={kind === ''} className={cx('rounded-full border px-3 py-1 text-xs font-medium', kind === '' ? 'border-accent bg-accent-soft text-accent' : 'bg-surface text-muted hover:text-ink')}>All <span className="ml-1 opacity-70">{alerts.length}</span></button>
            {kinds.map(([k, n]) => (
              <button key={k} onClick={() => setKind(k)} aria-pressed={kind === k} className={cx('rounded-full border px-3 py-1 text-xs font-medium', kind === k ? 'border-accent bg-accent-soft text-accent' : 'bg-surface text-muted hover:text-ink')}>{ALERT_LABEL[k]} <span className="ml-1 opacity-70">{n}</span></button>
            ))}
          </div>
          <Card pad={false}>
            <ul className="divide-y">
              {shown.map((a) => {
                const l = labs.find((x) => x.id === a.labId);
                return (
                  <li key={a.id}>
                    <Link to={scopePath(scope === ALL ? a.labId : scope, a.to)} className="flex items-start gap-3 px-4 py-3 hover:bg-surface2">
                      <Badge tone={a.severity === 'high' ? 'red' : a.severity === 'medium' ? 'amber' : 'gray'} className="mt-0.5 shrink-0">{ALERT_LABEL[a.kind]}</Badge>
                      <span className="min-w-0 flex-1 text-sm"><span className="block font-medium">{a.title}</span><span className="block text-muted">{a.detail}</span></span>
                      {scope === ALL && l && <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted"><span className="h-2 w-2 rounded-full" style={{ background: l.color }} />{l.short}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
