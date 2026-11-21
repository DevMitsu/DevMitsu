import { Download, Printer } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, Card, EmptyState, PageHeader, cx } from '../../components/ui';
import { download, toCSV } from '../../domain/csv';
import { addDays, fmtDate, startOfAcademicYear, startOfMonth, todayStr } from '../../domain/dates';
import { useScope } from '../../lib/scope';
import { useStore } from '../../store/store';
import { REPORTS } from './builders';

type Range = 'month' | '30' | '90' | 'year' | 'all' | 'custom';

export function ReportsPage() {
  const { scope, lab } = useScope();
  const state = useStore((s) => s);
  const [id, setId] = useState(REPORTS[0].id);
  const [range, setRange] = useState<Range>('90');
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(todayStr());
  const [groupBy, setGroupBy] = useState('item');
  const def = REPORTS.find((r) => r.id === id) ?? REPORTS[0];
  const today = todayStr();

  const [f, t] = useMemo((): [string, string] => {
    switch (range) {
      case 'month': return [startOfMonth(), '9999'];
      case '30': return [addDays(today, -30), '9999'];
      case '90': return [addDays(today, -90), '9999'];
      case 'year': return [startOfAcademicYear(), '9999'];
      case 'custom': return [from || '0000', to || '9999'];
      default: return ['0000', '9999'];
    }
  }, [range, from, to, today]);

  const table = useMemo(() => def.build({ state, scope, from: f, to: t, groupBy }), [def, state, scope, f, t, groupBy]);
  const numeric = new Set(table.numeric ?? []);
  const period = def.timed ? (f === '0000' ? 'All time' : `${fmtDate(f)} to ${t === '9999' ? fmtDate(today) : fmtDate(t)}`) : `As of ${fmtDate(today)}`;

  return (
    <div>
      <PageHeader icon="file" title={`Reports${lab ? ` · ${lab.name}` : ''}`} sub="Pick a report, set the period, then print it or download it for Excel." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[16rem_1fr]">
        <nav className="no-print space-y-1" aria-label="Reports">
          {REPORTS.map((r) => (
            <button key={r.id} onClick={() => setId(r.id)} aria-current={id === r.id} className={cx('block w-full rounded-lg px-3 py-2 text-left text-sm', id === r.id ? 'bg-accent-soft font-semibold text-accent' : 'text-muted hover:bg-surface2 hover:text-ink')}>{r.title}</button>
          ))}
        </nav>
        <div className="min-w-0">
          <p className="no-print mb-3 text-sm text-muted">{def.description}</p>
          <div className="no-print mb-3 flex flex-wrap items-center gap-2">
            {def.timed && (
              <>
                <select className="input w-auto" value={range} onChange={(e) => setRange(e.target.value as Range)} aria-label="Period">
                  <option value="month">This month</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="year">This academic year</option><option value="all">All time</option><option value="custom">Custom dates…</option>
                </select>
                {range === 'custom' && <><input type="date" className="input w-auto" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" /><span className="text-sm text-muted">to</span><input type="date" className="input w-auto" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" /></>}
              </>
            )}
            {def.groupOptions && <select className="input w-auto" value={groupBy} onChange={(e) => setGroupBy(e.target.value)} aria-label="Group by">{def.groupOptions.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select>}
            <div className="ml-auto flex gap-2">
              <Button onClick={() => download(`${def.id}-${today}.csv`, toCSV(table.columns, table.rows))}><Download className="h-4 w-4" /> Download CSV</Button>
              <Button onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
            </div>
          </div>

          <Card pad={false} className="print-area overflow-x-auto">
            <div className="border-b px-4 py-3">
              <div className="text-xs text-muted">{state.settings.schoolName} · {lab?.name ?? 'All labs'}</div>
              <h2 className="text-lg font-semibold">{table.title}</h2>
              <div className="text-xs text-muted">{period}</div>
              {table.notes?.map((n, i) => <div key={i} className="mt-1 text-sm">{n}</div>)}
            </div>
            {table.rows.length === 0 ? <EmptyState icon="file" title="Nothing to report">No entries match this report for the chosen period.</EmptyState> : (
              <table className="tbl">
                <thead><tr>{table.columns.map((c, n) => <th key={c} className={numeric.has(n) ? 'text-right' : ''}>{c}</th>)}</tr></thead>
                <tbody>{table.rows.map((r, i) => <tr key={i}>{r.map((c, n) => <td key={n} className={cx(numeric.has(n) && 'text-right tabular-nums', 'align-top')}>{c}</td>)}</tr>)}</tbody>
              </table>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
