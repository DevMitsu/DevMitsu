import { Download, Plus, Printer, ShoppingCart } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FieldValue } from '../../components/FieldInputs';
import { attempt, notify, tryDo } from '../../components/toast';
import { Badge, Button, Card, EmptyState, PageHeader, SearchBox, Stat, cx } from '../../components/ui';
import { download, toCSV } from '../../domain/csv';
import { addDays, daysBetween, fmtDate, startOfAcademicYear, startOfMonth, todayStr } from '../../domain/dates';
import { num, plain } from '../../domain/fields';
import { ALL, isLow, isOpenLoan, labOf } from '../../domain/inventory';
import type { LabRecord } from '../../domain/types';
import { useScope } from '../../lib/scope';
import { openRecord, setUi } from '../../lib/ui';
import { requestRestock, setRecordStatus } from '../../store/actions';
import { useStore } from '../../store/store';
import { recordDate, recordDay } from './helpers';

type Range = 'all' | 'month' | '30' | '90' | 'year' | 'custom';

const NEXT_STATUS: Record<string, { label: string; to: string }> = {
  Requested: { label: 'Approve', to: 'Approved' },
  Approved: { label: 'Mark ordered', to: 'Ordered' },
};

export function RecordsPage() {
  const { moduleId = '' } = useParams();
  const { scope, lab } = useScope();
  const state = useStore((s) => s);
  const mod = state.modules.find((m) => m.id === moduleId);
  const [q, setQ] = useState('');
  const [range, setRange] = useState<Range>('all');
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(todayStr());
  const [chip, setChip] = useState('all');
  const [limit, setLimit] = useState(100);
  const today = todayStr();

  const fields = useMemo(() => (mod?.fields ?? []).filter((f) => !f.hidden), [mod]);
  const cols = useMemo(() => (mod?.listFieldIds ?? []).map((id) => fields.find((f) => f.id === id)).filter((f): f is NonNullable<typeof f> => !!f), [mod, fields]);

  const inScope = useMemo(
    () => state.records.filter((r) => r.moduleId === moduleId && (scope === ALL || r.labId === scope)),
    [state.records, moduleId, scope],
  );

  const bounds = useMemo((): [string, string] => {
    switch (range) {
      case 'month': return [startOfMonth(), '9999'];
      case '30': return [addDays(today, -30), '9999'];
      case '90': return [addDays(today, -90), '9999'];
      case 'year': return [startOfAcademicYear(), '9999'];
      case 'custom': return [from || '0000', to || '9999'];
      default: return ['0000', '9999'];
    }
  }, [range, from, to, today]);

  const isOpen = (r: LabRecord) => {
    if (!mod) return false;
    if (mod.kind === 'loan') return isOpenLoan(r);
    if (mod.statusFieldId && mod.closedValues) return !mod.closedValues.includes(String(r.values[mod.statusFieldId] ?? ''));
    return false;
  };
  const overdue = (r: LabRecord) => mod?.kind === 'loan' && isOpenLoan(r) && !!r.values.due && String(r.values.due) < today;

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return inScope
      .filter((r) => {
        const d = recordDay(mod, r);
        if (d < bounds[0] || d > bounds[1]) return false;
        if (chip === 'open' && !isOpen(r)) return false;
        if (chip === 'closed' && isOpen(r)) return false;
        if (chip === 'overdue' && !overdue(r)) return false;
        if (!t) return true;
        return fields.map((f) => plain(state, f, r.values[f.id])).join(' ').toLowerCase().includes(t);
      })
      .sort((a, b) => recordDate(mod, b).localeCompare(recordDate(mod, a)) || b.createdAt.localeCompare(a.createdAt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inScope, q, bounds, chip, fields, state.items]);

  if (!mod || !mod.enabled) {
    return <Card><EmptyState icon="clipboard" title="This log is not available">It may be switched off or restricted to another lab. You can change that under Customise → Forms & logs.</EmptyState></Card>;
  }

  const openCount = inScope.filter(isOpen).length;
  const overdueCount = inScope.filter(overdue).length;
  const chips: { id: string; label: string; n?: number }[] = mod.kind === 'loan'
    ? [{ id: 'all', label: 'All' }, { id: 'open', label: 'Out now', n: openCount }, { id: 'overdue', label: 'Overdue', n: overdueCount }, { id: 'closed', label: 'Returned' }]
    : mod.statusFieldId && mod.closedValues
      ? [{ id: 'all', label: 'All' }, { id: 'open', label: 'Open', n: openCount }, { id: 'closed', label: 'Finished' }]
      : [];

  const exportCsv = () => {
    const head = ['Lab', ...fields.map((f) => f.label), 'Entered by', 'Entered at'];
    download(`${mod.name.toLowerCase().replace(/\W+/g, '-')}.csv`, toCSV(head, rows.map((r) => [labOf(state, r.labId)?.name, ...fields.map((f) => plain(state, f, r.values[f.id])), r.by ?? '', r.createdAt])));
  };

  // Header stats for the logs that have a story to tell
  const stats: React.ReactNode[] = [];
  if (mod.kind === 'incident') {
    const dates = inScope.filter((r) => r.values.type !== 'Near miss').map((r) => String(r.values.when ?? '').slice(0, 10)).filter(Boolean).sort();
    const last = dates[dates.length - 1];
    stats.push(<Stat key="d" label="Days since last accident" value={last ? Math.max(0, daysBetween(last, today)) : '—'} sub={last ? `Last: ${fmtDate(last)} (near misses not counted)` : 'None recorded'} tone={last && daysBetween(last, today) < 7 ? 'amber' : 'green'} icon="siren" />);
    stats.push(<Stat key="o" label="Open follow-ups" value={openCount} tone={openCount ? 'amber' : 'green'} />);
  }
  if (mod.kind === 'loan') {
    stats.push(<Stat key="o" label="Out now" value={openCount} icon="swap" />);
    stats.push(<Stat key="l" label="Overdue" value={overdueCount} tone={overdueCount ? 'red' : 'green'} />);
  }
  if (mod.kind === 'requisition') {
    const cost = inScope.filter(isOpen).reduce((n, r) => n + (num(r.values.estCost) ?? 0), 0);
    stats.push(<Stat key="o" label="Open requirements" value={openCount} icon="cart" />);
    stats.push(<Stat key="u" label="Urgent" value={inScope.filter((r) => isOpen(r) && r.values.priority === 'Urgent').length} tone="red" />);
    stats.push(<Stat key="c" label="Estimated cost of open ones" value={`${state.settings.currency}${Math.round(cost).toLocaleString('en-IN')}`} />);
  }

  // Requirements: items already below their reorder level with nothing on order
  const needRestock = mod.kind === 'requisition'
    ? state.items.filter((i) => !i.archived && (scope === ALL || i.labId === scope) && isLow(i) && !inScope.some((r) => isOpen(r) && r.values.item === i.id))
    : [];

  return (
    <div>
      <PageHeader
        icon={mod.icon}
        title={`${mod.name}${lab ? ` · ${lab.name}` : ''}`}
        sub={mod.description}
        actions={<>
          <Button onClick={exportCsv}><Download className="h-4 w-4" /> Export</Button>
          <Button onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
          <Button variant="primary" onClick={() => openRecord(mod.id, { labId: lab?.id })}><Plus className="h-4 w-4" /> New {mod.singular.toLowerCase()}</Button>
        </>}
      />

      {stats.length > 0 && <div className="mb-4 grid gap-3 sm:grid-cols-3">{stats}</div>}

      {needRestock.length > 0 && (
        <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl tone-amber p-3 text-sm">
          <span><b>{needRestock.length} item{needRestock.length > 1 ? 's are' : ' is'} at or below the reorder level</b> with nothing requested: {needRestock.slice(0, 3).map((i) => i.name).join(', ')}{needRestock.length > 3 ? '…' : ''}</span>
          <Button size="sm" onClick={() => { const n = attempt(() => requestRestock(needRestock.map((i) => i.id)), 'Restock requests created'); if (n === 0) notify('Nothing to request.', 'info'); }}><ShoppingCart className="h-3.5 w-3.5" /> Request all</Button>
        </div>
      )}

      <div className="no-print mb-3 flex flex-wrap items-center gap-2">
        <SearchBox value={q} onChange={setQ} placeholder={`Search ${mod.name.toLowerCase()}…`} className="w-full sm:w-72" />
        <select className="input w-auto" value={range} onChange={(e) => setRange(e.target.value as Range)} aria-label="Period">
          <option value="all">All time</option><option value="month">This month</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="year">This academic year</option><option value="custom">Custom dates…</option>
        </select>
        {range === 'custom' && <><input type="date" className="input w-auto" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" /><span className="text-sm text-muted">to</span><input type="date" className="input w-auto" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" /></>}
        {chips.map((c) => (
          <button key={c.id} onClick={() => setChip(c.id)} aria-pressed={chip === c.id} className={cx('rounded-full border px-3 py-1 text-xs font-medium', chip === c.id ? 'border-accent bg-accent-soft text-accent' : 'bg-surface text-muted hover:text-ink')}>
            {c.label}{c.n != null && <span className="ml-1 opacity-70">{c.n}</span>}
          </button>
        ))}
        <span className="ml-auto text-sm text-muted">{rows.length} {rows.length === 1 ? 'entry' : 'entries'}</span>
      </div>

      <Card pad={false} className="print-area overflow-x-auto">
        {rows.length === 0 ? (
          <EmptyState icon={mod.icon} title={inScope.length === 0 ? `No ${mod.name.toLowerCase()} yet` : 'Nothing matches'} action={inScope.length === 0 ? <Button variant="primary" onClick={() => openRecord(mod.id, { labId: lab?.id })}><Plus className="h-4 w-4" /> New {mod.singular.toLowerCase()}</Button> : undefined}>
            {inScope.length === 0 ? mod.description : 'Try another period or search.'}
          </EmptyState>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                {scope === ALL && <th>Lab</th>}
                {cols.map((f) => <th key={f.id}>{f.label}</th>)}
                <th className="no-print" />
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((r) => {
                const l = labOf(state, r.labId);
                const status = mod.statusFieldId ? String(r.values[mod.statusFieldId] ?? '') : '';
                return (
                  <tr key={r.id} className="clickable" onClick={() => openRecord(mod.id, { id: r.id })}>
                    {scope === ALL && <td><span className="inline-flex items-center gap-1.5 text-muted"><span className="h-2 w-2 rounded-full" style={{ background: l?.color }} />{l?.short}</span></td>}
                    {cols.map((f) => (
                      <td key={f.id} className="max-w-xs">
                        {mod.kind === 'loan' && f.id === 'due' && overdue(r) ? <Badge tone="red">{fmtDate(String(r.values.due))} · overdue</Badge>
                          : mod.kind === 'loan' && f.id === 'returned' && !r.values.returned ? <Badge tone="blue">Out</Badge>
                          : <FieldValue def={f} value={r.values[f.id]} scope={scope === ALL ? r.labId : scope} compact />}
                      </td>
                    ))}
                    <td className="no-print text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {mod.kind === 'loan' && isOpenLoan(r) && <Button size="sm" onClick={() => setUi({ ret: r.id })}>Return</Button>}
                      {mod.kind === 'requisition' && NEXT_STATUS[status] && <Button size="sm" onClick={() => tryDo(() => setRecordStatus(r.id, NEXT_STATUS[status].to), `Marked ${NEXT_STATUS[status].to.toLowerCase()}`)}>{NEXT_STATUS[status].label}</Button>}
                      {mod.kind === 'requisition' && status === 'Ordered' && <Button size="sm" variant="primary" onClick={() => setUi({ receiveReq: r.id })}>Receive</Button>}
                      {(mod.kind === 'incident' || mod.kind === 'spill') && isOpen(r) && <Button size="sm" onClick={() => tryDo(() => setRecordStatus(r.id, 'Closed'), 'Closed')}>Close</Button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {rows.length > limit && <div className="border-t p-3 text-center"><Button onClick={() => setLimit((l) => l + 200)}>Show more ({rows.length - limit} left)</Button></div>}
      </Card>
    </div>
  );
}
