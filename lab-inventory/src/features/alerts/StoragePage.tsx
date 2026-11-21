import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Card, EmptyState, PageHeader } from '../../components/ui';
import { storageConflicts } from '../../domain/alerts';
import { ALL } from '../../domain/inventory';
import { scopePath, useScope } from '../../lib/scope';
import { useStore } from '../../store/store';

/** What is kept where, grouped by storage group, with unsafe combinations flagged. */
export function StoragePage() {
  const { scope, lab } = useScope();
  const state = useStore((s) => s);
  const conflicts = useMemo(() => storageConflicts(state).filter((c) => scope === ALL || c.labId === scope), [state, scope]);

  const places = useMemo(() => {
    const m = new Map<string, { labId: string; location: string; groups: Map<string, typeof state.items> }>();
    for (const i of state.items) {
      if (i.archived || i.quantity <= 0 || !i.storageGroup || !i.location) continue;
      if (scope !== ALL && i.labId !== scope) continue;
      const key = `${i.labId}\u0000${i.location}`;
      const p = m.get(key) ?? { labId: i.labId, location: i.location, groups: new Map() };
      p.groups.set(i.storageGroup, [...(p.groups.get(i.storageGroup) ?? []), i]);
      m.set(key, p);
    }
    return [...m.values()].sort((a, b) => a.location.localeCompare(b.location));
  }, [state, scope]);

  const untagged = state.items.filter((i) => !i.archived && i.quantity > 0 && (scope === ALL || i.labId === scope) && state.categories.find((c) => c.id === i.categoryId)?.hazardous && (!i.storageGroup || !i.location));
  const bad = (labId: string, location: string, group: string) =>
    conflicts.some((c) => c.labId === labId && c.title.includes(` in ${location}`) && c.title.includes(group));

  return (
    <div>
      <PageHeader icon="shield" title={`Storage check${lab ? ` · ${lab.name}` : ''}`}
        sub="Chemicals are checked against the pairs that must not share a shelf (acids and bases, oxidisers and flammables…). Edit the pairs under Customise → Alerts & rules." />

      <Card className="mb-4" pad={false}>
        <div className="flex items-center gap-2 border-b px-4 py-3 font-semibold">
          {conflicts.length ? <AlertTriangle className="h-5 w-5 text-[var(--t-red-fg)]" /> : <CheckCircle2 className="h-5 w-5 text-[var(--t-green-fg)]" />}
          {conflicts.length ? `${conflicts.length} unsafe combination${conflicts.length > 1 ? 's' : ''}` : 'No unsafe combinations found'}
        </div>
        {conflicts.map((c) => (
          <div key={c.id} className="border-b px-4 py-3 text-sm last:border-0"><b>{c.title}</b><div className="text-muted">{c.detail}</div></div>
        ))}
      </Card>

      {untagged.length > 0 && (
        <div className="mb-4 rounded-xl tone-amber p-3 text-sm">
          <b>{untagged.length} hazardous item{untagged.length > 1 ? 's have' : ' has'} no storage group or location,</b> so they cannot be checked:{' '}
          {untagged.slice(0, 6).map((i, n) => <span key={i.id}>{n > 0 && ', '}<Link className="underline" to={scopePath(scope === ALL ? i.labId : scope, `items/${i.id}`)}>{i.name}</Link></span>)}{untagged.length > 6 && '…'}
        </div>
      )}

      {places.length === 0 ? (
        <Card><EmptyState icon="boxes" title="Nothing to check yet">Give chemicals a <b>location</b> and a <b>storage group</b> on their item page and they appear here.</EmptyState></Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {places.map((p) => (
            <Card key={`${p.labId}${p.location}`}>
              <h3 className="mb-2 font-semibold">{p.location}{scope === ALL && <span className="ml-2 text-xs font-normal text-muted">{state.labs.find((l) => l.id === p.labId)?.short}</span>}</h3>
              <div className="space-y-2">
                {[...p.groups.entries()].map(([g, list]) => (
                  <div key={g}>
                    <Badge tone={bad(p.labId, p.location, g) ? 'red' : 'gray'}>{g}</Badge>
                    <div className="mt-1 text-sm text-muted">{list.map((i, n) => <span key={i.id}>{n > 0 && ', '}<Link className="hover:underline" to={scopePath(scope === ALL ? i.labId : scope, `items/${i.id}`)}>{i.name}</Link></span>)}</div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
