import { useMemo, useRef, useState } from 'react';
import { Badge, Button, Card, EmptyState, Field, PageHeader } from '../../components/ui';
import { attempt, confirmDialog } from '../../components/toast';
import { fmtDateTime } from '../../domain/dates';
import { ALL, categoriesForLab } from '../../domain/inventory';
import { useScope } from '../../lib/scope';
import { finishStocktake } from '../../store/actions';
import { useStore } from '../../store/store';

export function StocktakePage() {
  const { scope, labs, lab } = useScope();
  const state = useStore((s) => s);
  const [labId, setLabId] = useState(scope !== ALL ? scope : (labs[0]?.id ?? ''));
  const activeLab = scope !== ALL ? scope : labId;
  const [cat, setCat] = useState('');
  const [loc, setLoc] = useState('');
  const [counts, setCounts] = useState<Record<string, string>>({});
  const root = useRef<HTMLTableElement>(null);

  const labItems = useMemo(() => state.items.filter((i) => i.labId === activeLab && !i.archived), [state.items, activeLab]);
  const locations = useMemo(() => [...new Set(labItems.map((i) => i.location).filter(Boolean) as string[])].sort(), [labItems]);
  const rows = useMemo(() => labItems.filter((i) => (!cat || i.categoryId === cat) && (!loc || i.location === loc)).sort((a, b) => (a.location ?? '~').localeCompare(b.location ?? '~') || a.name.localeCompare(b.name)), [labItems, cat, loc]);

  const counted = rows.filter((r) => counts[r.id] !== undefined && counts[r.id] !== '');
  const diffs = counted.filter((r) => Number(counts[r.id]) !== r.quantity);
  const bad = counted.some((r) => !(Number(counts[r.id]) >= 0));
  const scopeText = [state.labs.find((l) => l.id === activeLab)?.name, cat && state.categories.find((c) => c.id === cat)?.name, loc].filter(Boolean).join(' · ');
  const past = state.stocktakes.filter((s) => scope === ALL || s.labId === scope);

  const finish = async () => {
    const ok = await confirmDialog({ title: `Apply the count for ${counted.length} items?`, body: diffs.length ? `${diffs.length} item${diffs.length > 1 ? 's' : ''} differ from the system. Their stock will be corrected and the change kept in each item's history. Items you left blank are not touched.` : 'Everything matches the system. The stocktake will be recorded.', confirm: 'Apply count' });
    if (!ok) return;
    const n = attempt(() => finishStocktake(activeLab, scopeText, counted.map((r) => ({ itemId: r.id, expected: r.quantity, counted: Number(counts[r.id]) }))), 'Stocktake saved');
    if (n !== undefined) setCounts({});
  };

  const focusNext = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const inputs = [...(root.current?.querySelectorAll('input[data-count]') ?? [])] as HTMLInputElement[];
    inputs[inputs.indexOf(e.currentTarget) + 1]?.focus();
  };

  return (
    <div>
      <PageHeader icon="scale" title={`Stocktake${lab ? ` · ${lab.name}` : ''}`} sub="Count what is really on the shelves and type it in. Enter jumps to the next row. Only items you count are changed, and every correction is kept in the item's history." />
      <div className="no-print mb-3 flex flex-wrap items-end gap-3">
        {scope === ALL && <Field label="Lab"><select className="input w-auto" value={labId} onChange={(e) => { setLabId(e.target.value); setCat(''); setLoc(''); setCounts({}); }}>{labs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>}
        <Field label="Category"><select className="input w-auto" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All</option>{categoriesForLab(state, activeLab).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Location"><select className="input w-auto" value={loc} onChange={(e) => setLoc(e.target.value)}><option value="">All</option>{locations.map((l) => <option key={l}>{l}</option>)}</select></Field>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-muted">{counted.length}/{rows.length} counted{diffs.length ? ` · ${diffs.length} differ` : ''}</span>
          <Button onClick={() => setCounts(Object.fromEntries([...Object.entries(counts), ...rows.filter((r) => counts[r.id] === undefined || counts[r.id] === '').map((r) => [r.id, String(r.quantity)])]))}>Fill blanks with “matches”</Button>
          <Button variant="primary" disabled={counted.length === 0 || bad} onClick={finish}>Apply count</Button>
        </div>
      </div>

      <Card pad={false} className="overflow-x-auto">
        {rows.length === 0 ? <EmptyState icon="scale" title="No items to count">Add items to this lab first, or change the filters.</EmptyState> : (
          <table className="tbl" ref={root}>
            <thead><tr><th>Location</th><th>Code</th><th>Item</th><th className="text-right">System says</th><th className="w-40">Counted</th><th className="w-28">Difference</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const c = counts[r.id];
                const has = c !== undefined && c !== '';
                const d = has ? Math.round((Number(c) - r.quantity) * 1e6) / 1e6 : 0;
                return (
                  <tr key={r.id} style={has && d !== 0 ? { background: 'var(--t-amber-bg)' } : undefined}>
                    <td className="text-muted">{r.location ?? '—'}</td>
                    <td className="font-mono text-xs whitespace-nowrap text-muted">{r.code}</td>
                    <td className="font-medium">{r.name}</td>
                    <td className="text-right tabular-nums">{r.quantity} {r.unit}</td>
                    <td><input data-count className="input py-1" type="number" min="0" step="any" aria-label={`Counted ${r.name}`} value={c ?? ''} onChange={(e) => setCounts((x) => ({ ...x, [r.id]: e.target.value }))} onKeyDown={focusNext} /></td>
                    <td>{has ? d === 0 ? <Badge tone="green">matches</Badge> : <Badge tone={d < 0 ? 'red' : 'blue'}>{d > 0 ? '+' : ''}{d} {r.unit}</Badge> : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {past.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 font-semibold">Past stocktakes</h2>
          <Card pad={false} className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>When</th><th>Scope</th><th className="text-right">Items counted</th><th className="text-right">Differences</th><th>By</th></tr></thead>
              <tbody>{past.slice(0, 15).map((s) => <tr key={s.id}><td className="whitespace-nowrap">{fmtDateTime(s.at)}</td><td>{s.scope}</td><td className="text-right tabular-nums">{s.lines.length}</td><td className="text-right tabular-nums">{s.lines.filter((l) => l.counted !== l.expected).length}</td><td className="text-muted">{s.by ?? ''}</td></tr>)}</tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  );
}
