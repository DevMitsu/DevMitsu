import { Archive, ArchiveRestore, ChevronDown, ChevronUp, Columns3, Download, FileUp, Plus, ShoppingCart } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Badge, Button, Checkbox, EmptyState, Field, Modal, PageHeader, Popover, SearchBox, cx } from '../../components/ui';
import { attempt, tryDo } from '../../components/toast';
import { download, toCSV } from '../../domain/csv';
import { ALL, categoriesForLab, expiryState, isLow, outOnLoan, serviceState } from '../../domain/inventory';
import type { Item } from '../../domain/types';
import { scopePath, useScope } from '../../lib/scope';
import { openItem, setUi } from '../../lib/ui';
import { bulkUpdateItems, requestRestock, updateSettings } from '../../store/actions';
import { useStore } from '../../store/store';
import { buildColumns, makeCtx } from './columns';

const FILTERS = [
  { id: 'low', label: 'Low or out of stock' },
  { id: 'expiry', label: 'Expired or expiring' },
  { id: 'service', label: 'Service due' },
  { id: 'hazard', label: 'Hazardous' },
  { id: 'loan', label: 'On loan' },
  { id: 'attention', label: 'Needs attention' },
] as const;

export function ItemsPage() {
  const { scope, lab } = useScope();
  const navigate = useNavigate();
  const state = useStore((s) => s);
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const filter = params.get('f') ?? '';
  const [cat, setCat] = useState('');
  const [loc, setLoc] = useState('');
  const [status, setStatus] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [sort, setSort] = useState<{ col: string; dir: 1 | -1 }>({ col: 'name', dir: 1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(150);
  const [bulk, setBulk] = useState<null | 'move' | 'status' | 'category'>(null);

  const out = useMemo(() => outOnLoan(state.records), [state.records]);
  const ctx = useMemo(() => makeCtx(state, out), [state, out]);
  const columns = useMemo(() => buildColumns(state), [state]);
  const visibleIds = state.settings.itemColumns;
  const visible = useMemo(() => {
    const ids = scope === ALL && !visibleIds.includes('lab') ? ['lab', ...visibleIds] : visibleIds;
    return ids.map((id) => columns.find((c) => c.id === id)).filter((c): c is NonNullable<typeof c> => !!c);
  }, [columns, visibleIds, scope]);

  const scoped = useMemo(() => state.items.filter((i) => (scope === ALL || i.labId === scope) && (showArchived ? true : !i.archived)), [state.items, scope, showArchived]);
  const cats = useMemo(() => categoriesForLab(state, scope), [state, scope]);
  const locations = useMemo(() => [...new Set(scoped.map((i) => i.location).filter(Boolean) as string[])].sort(), [scoped]);

  const matchesFilter = (i: Item, f: string) => {
    const c = state.categories.find((x) => x.id === i.categoryId);
    switch (f) {
      case 'low': return isLow(i);
      case 'expiry': return !!c?.trackExpiry && ['expired', 'soon'].includes(expiryState(i, state.settings.expiryWarnDays, ctx.today));
      case 'service': return ['overdue', 'soon'].includes(serviceState(i, state.settings.serviceWarnDays, ctx.today));
      case 'hazard': return !!i.hazards?.length;
      case 'loan': return (out.get(i.id) ?? 0) > 0;
      case 'attention': return i.status !== 'Good';
      default: return true;
    }
  };

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = scoped.filter((i) => {
      if (cat && i.categoryId !== cat) return false;
      if (loc && i.location !== loc) return false;
      if (status && i.status !== status) return false;
      if (filter && !matchesFilter(i, filter)) return false;
      if (!t) return true;
      const extra = Object.values(i.custom).map((v) => (Array.isArray(v) ? v.join(' ') : String(v ?? ''))).join(' ');
      return `${i.name} ${i.code} ${i.location ?? ''} ${i.supplier ?? ''} ${i.lot ?? ''} ${i.tags?.join(' ') ?? ''} ${i.description ?? ''} ${i.hazards?.join(' ') ?? ''} ${extra}`.toLowerCase().includes(t);
    });
    const col = columns.find((c) => c.id === sort.col) ?? columns[1];
    return list.sort((a, b) => {
      const x = col.get(a, ctx);
      const y = col.get(b, ctx);
      if (x === y) return a.name.localeCompare(b.name);
      if (x === undefined) return 1;
      if (y === undefined) return -1;
      return (x < y ? -1 : 1) * sort.dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoped, q, cat, loc, status, filter, sort, columns, ctx, out]);

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.id, scoped.filter((i) => !i.archived && matchesFilter(i, f.id)).length])), // eslint-disable-next-line react-hooks/exhaustive-deps
    [scoped, ctx, out]);

  const setFilter = (f: string) => {
    const p = new URLSearchParams(params);
    if (f && f !== filter) p.set('f', f); else p.delete('f');
    setParams(p, { replace: true });
    setLimit(150);
  };
  const toggleSort = (id: string) => setSort((s) => (s.col === id ? { col: id, dir: (s.dir * -1) as 1 | -1 } : { col: id, dir: 1 }));
  const allSelected = rows.length > 0 && rows.slice(0, limit).every((r) => selected.has(r.id));
  const sel = [...selected].filter((id) => rows.some((r) => r.id === id));

  const exportCsv = (list: Item[]) => {
    const cols = visible;
    download(`${lab?.short ?? 'all-labs'}-inventory.csv`, toCSV(cols.map((c) => c.label), list.map((i) => cols.map((c) => c.get(i, ctx) === '9999' ? '' : c.get(i, ctx)))));
  };

  const empty = state.items.filter((i) => scope === ALL || i.labId === scope).length === 0;
  const addTarget = scope === ALL ? undefined : scope;

  return (
    <div>
      <PageHeader
        icon="boxes"
        title={`Inventory${lab ? ` · ${lab.name}` : ''}`}
        sub={`${scoped.filter((i) => !i.archived).length} items${rows.length !== scoped.length ? ` · ${rows.length} shown` : ''}`}
        actions={
          <>
            <Popover trigger={<><Columns3 className="h-4 w-4" /> Columns</>}>
              {(['Main', 'Stock', 'Safety', 'Dates', 'Category fields'] as const).map((g) => {
                const list = columns.filter((c) => c.group === g && c.id !== 'lab');
                if (!list.length) return null;
                return (
                  <div key={g} className="mb-2 last:mb-0">
                    <div className="px-1 pb-1 text-xs font-semibold text-muted uppercase">{g}</div>
                    {list.map((c) => (
                      <div key={c.id} className="px-1 py-0.5">
                        <Checkbox checked={visibleIds.includes(c.id)} onChange={(on) => updateSettings({ itemColumns: on ? [...visibleIds, c.id] : visibleIds.filter((x) => x !== c.id) })}>{c.label}</Checkbox>
                      </div>
                    ))}
                  </div>
                );
              })}
            </Popover>
            <Button onClick={() => exportCsv(rows)}><Download className="h-4 w-4" /> Export</Button>
            <Button onClick={() => setUi({ importLab: addTarget ?? state.labs.find((l) => !l.archived)?.id })}><FileUp className="h-4 w-4" /> Import</Button>
            <Button variant="primary" onClick={() => openItem({ labId: addTarget })}><Plus className="h-4 w-4" /> Add item</Button>
          </>
        }
      />

      {empty ? (
        <div className="card">
          <EmptyState icon="boxes" title="No items yet" action={<div className="flex gap-2"><Button variant="primary" onClick={() => openItem({ labId: addTarget })}><Plus className="h-4 w-4" /> Add the first item</Button><Button onClick={() => setUi({ importLab: addTarget ?? state.labs.find((l) => !l.archived)?.id })}><FileUp className="h-4 w-4" /> Import from Excel</Button></div>}>
            Add equipment and substances one by one, or paste a whole sheet from Excel to get started quickly.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="no-print mb-3 flex flex-wrap items-center gap-2">
            <SearchBox value={q} onChange={(v) => { setQ(v); setLimit(150); }} placeholder="Search name, code, CAS, location, tag…" className="w-full sm:w-72" />
            <select className="input w-auto" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category"><option value="">All categories</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <select className="input w-auto" value={loc} onChange={(e) => setLoc(e.target.value)} aria-label="Location"><option value="">All locations</option>{locations.map((l) => <option key={l}>{l}</option>)}</select>
            <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="">Any status</option>{(state.lists.find((l) => l.id === 'itemStatus')?.options ?? []).map((l) => <option key={l}>{l}</option>)}</select>
            <Checkbox checked={showArchived} onChange={setShowArchived}>Show archived</Checkbox>
          </div>
          <div className="no-print mb-3 flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button key={f.id} onClick={() => setFilter(f.id)} aria-pressed={filter === f.id} className={cx('rounded-full border px-3 py-1 text-xs font-medium', filter === f.id ? 'border-accent bg-accent-soft text-accent' : 'bg-surface text-muted hover:text-ink')}>
                {f.label} <span className="ml-1 opacity-70">{counts[f.id]}</span>
              </button>
            ))}
          </div>

          {sel.length > 0 && (
            <div className="no-print card mb-3 flex flex-wrap items-center gap-2 border-accent p-2.5">
              <b className="px-1 text-sm">{sel.length} selected</b>
              <Button size="sm" onClick={() => setBulk('move')}>Move to location</Button>
              <Button size="sm" onClick={() => setBulk('status')}>Set status</Button>
              <Button size="sm" onClick={() => setBulk('category')}>Change category</Button>
              <Button size="sm" onClick={() => { const n = attempt(() => requestRestock(sel), 'Restock requested'); if (n === 0) attempt(() => { throw new Error('Nothing to request: those items already have an open requirement.'); }); }}><ShoppingCart className="h-3.5 w-3.5" /> Request restock</Button>
              <Button size="sm" onClick={() => exportCsv(rows.filter((r) => selected.has(r.id)))}><Download className="h-3.5 w-3.5" /> Export</Button>
              {rows.filter((r) => selected.has(r.id)).some((r) => !r.archived) ? (
                <Button size="sm" onClick={() => { tryDo(() => bulkUpdateItems(sel, { archived: true }), 'Archived'); setSelected(new Set()); }}><Archive className="h-3.5 w-3.5" /> Archive</Button>
              ) : (
                <Button size="sm" onClick={() => { tryDo(() => bulkUpdateItems(sel, { archived: false }), 'Restored'); setSelected(new Set()); }}><ArchiveRestore className="h-3.5 w-3.5" /> Restore</Button>
              )}
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>Clear</Button>
            </div>
          )}

          <div className="card print-area overflow-x-auto">
            {rows.length === 0 ? (
              <EmptyState icon="boxes" title="Nothing matches" action={<Button onClick={() => { setQ(''); setCat(''); setLoc(''); setStatus(''); setFilter(''); }}>Clear filters</Button>}>Try a different search or remove a filter.</EmptyState>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="no-print w-8"><input type="checkbox" aria-label="Select all" className="accent-[var(--accent)]" checked={allSelected} onChange={(e) => setSelected(e.target.checked ? new Set(rows.slice(0, limit).map((r) => r.id)) : new Set())} /></th>
                    {visible.map((c) => (
                      <th key={c.id} className={c.right ? 'text-right' : ''} aria-sort={sort.col === c.id ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                        <button className="inline-flex items-center gap-1 uppercase" onClick={() => toggleSort(c.id)}>
                          {c.label}{sort.col === c.id && (sort.dir === 1 ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, limit).map((i) => (
                    <tr key={i.id} className="clickable" onClick={() => navigate(scopePath(scope, `items/${i.id}`))} style={i.archived ? { opacity: 0.55 } : undefined}>
                      <td className="no-print" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" aria-label={`Select ${i.name}`} className="accent-[var(--accent)]" checked={selected.has(i.id)} onChange={(e) => setSelected((s) => { const n = new Set(s); if (e.target.checked) n.add(i.id); else n.delete(i.id); return n; })} />
                      </td>
                      {visible.map((c) => <td key={c.id} className={c.right ? 'text-right' : ''}>{c.cell(i, ctx)}{c.id === 'name' && i.archived && <Badge className="ml-2">archived</Badge>}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {rows.length > limit && <div className="border-t p-3 text-center"><Button onClick={() => setLimit((l) => l + 200)}>Show more ({rows.length - limit} left)</Button></div>}
          </div>
        </>
      )}
      {bulk && <BulkDialog kind={bulk} ids={sel} onClose={() => { setBulk(null); setSelected(new Set()); }} />}
    </div>
  );
}

function BulkDialog({ kind, ids, onClose }: { kind: 'move' | 'status' | 'category'; ids: string[]; onClose: () => void }) {
  const state = useStore((s) => s);
  const items = state.items.filter((i) => ids.includes(i.id));
  const labs = [...new Set(items.map((i) => i.labId))];
  const single = labs.length === 1 ? state.labs.find((l) => l.id === labs[0]) : undefined;
  const [value, setValue] = useState('');
  const options = kind === 'status' ? (state.lists.find((l) => l.id === 'itemStatus')?.options ?? []) : kind === 'category' ? categoriesForLab(state, single?.id ?? ALL).map((c) => c.id) : (single?.locations ?? []);
  const label = (o: string) => (kind === 'category' ? (state.categories.find((c) => c.id === o)?.name ?? o) : o);
  const apply = () => {
    const patch = kind === 'move' ? { location: value.trim() } : kind === 'status' ? { status: value } : { categoryId: value };
    if (tryDo(() => bulkUpdateItems(ids, patch), `Updated ${ids.length} items`)) onClose();
  };
  return (
    <Modal size="sm" title={kind === 'move' ? 'Move to a location' : kind === 'status' ? 'Set status' : 'Change category'} sub={`${ids.length} items`} onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!value.trim()} onClick={apply}>Apply</Button></>}>
      {kind === 'move' ? (
        <Field label="New location" help={single ? undefined : 'These items are in different labs: the place is typed in as text.'}>
          <input className="input" list="bulk-locs" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
          <datalist id="bulk-locs">{options.map((o) => <option key={o} value={o} />)}</datalist>
        </Field>
      ) : (
        <Field label={kind === 'status' ? 'New status' : 'New category'}>
          <select className="input" value={value} onChange={(e) => setValue(e.target.value)} autoFocus><option value="">Choose…</option>{options.map((o) => <option key={o} value={o}>{label(o)}</option>)}</select>
        </Field>
      )}
    </Modal>
  );
}
