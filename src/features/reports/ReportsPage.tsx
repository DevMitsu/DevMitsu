import { useMemo, useState } from 'react';
import { Copy, Download } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Panel } from '../../components/ui/Panel';
import { PageHeader } from '../../components/ui/PageHeader';
import { Select } from '../../components/ui/Select';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { toast } from '../../components/ui/toast';
import { addDays, allClassIds, LIBRARIES, todayISO } from '../../domain/rules';
import { cn } from '../../lib/cn';
import { useStore } from '../../store/store';
import { buildReport, REPORTS, toCsv, type Opts, type ReportId } from './builders';

const LIMIT = 200;

export function ReportsPage() {
  const state = useStore((s) => s);
  const today = todayISO();
  const [id, setId] = useState<ReportId>('circulation');
  const [o, setO] = useState<Opts>({ from: addDays(today, -30), to: today, library: 'both', arrange: 'date', circulation: 'all', classId: '' });
  const ALL_CLASSES = useMemo(() => allClassIds(state.sections), [state.sections]);
  const meta = REPORTS.find((r) => r.id === id)!;
  const built = useMemo(() => buildReport(state, id, o), [state, id, o]);
  const set = (patch: Partial<Opts>) => setO((x) => ({ ...x, ...patch }));
  const choose = (r: ReportId) => { setId(r); if (r === 'waived' && o.arrange === 'author') set({ arrange: 'date' }); };
  const invalid = meta.usesRange && o.from > o.to;

  const presets: Array<[string, () => void]> = [
    ['Today', () => set({ from: today, to: today })],
    ['Last 7 days', () => set({ from: addDays(today, -6), to: today })],
    ['Last 30 days', () => set({ from: addDays(today, -29), to: today })],
    ['This month', () => set({ from: today.slice(0, 8) + '01', to: today })],
    ['This academic year', () => set({ from: `${Number(today.slice(5, 7)) >= 4 ? today.slice(0, 4) : Number(today.slice(0, 4)) - 1}-04-01`, to: today })],
  ];

  const copy = async () => {
    try { await navigator.clipboard.writeText(toCsv(built)); toast('Copied. Paste it into a spreadsheet.'); }
    catch { toast('Copying was blocked. Use Download instead.', { tone: 'error' }); }
  };
  const download = () => {
    try {
      const url = URL.createObjectURL(new Blob([toCsv(built)], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a'); a.href = url; a.download = `alexandria-${id}-${o.from}-to-${o.to}.csv`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000); toast('Download started. If nothing downloads here, use Copy for spreadsheet instead.');
    } catch { toast('Download is not available here. Use Copy instead.', { tone: 'error' }); }
  };

  return (
    <div>
      <PageHeader title="Reports" description="Date-range lists you can copy into a spreadsheet or download." />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <nav aria-label="Reports" className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <ul className="flex gap-1 overflow-x-auto lg:flex-col">
            {REPORTS.map((r) => (
              <li key={r.id} className="shrink-0"><button type="button" aria-pressed={r.id === id} onClick={() => choose(r.id)} className={cn('h-10 w-full rounded-control px-3 text-left text-sm font-medium', r.id === id ? 'bg-sage text-on-sage' : 'text-muted hover:bg-sage-soft hover:text-ink')}>{r.label}</button></li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0">
          <p className="mb-3 text-sm text-muted">{meta.hint}</p>
          <Panel className="mb-4 p-4">
            <div className="flex flex-wrap items-end gap-3">
              {meta.usesRange && (<>
                <label className="block text-[13px] font-medium">From<input type="date" value={o.from} max={o.to} onChange={(e) => e.target.value && set({ from: e.target.value })} className="mt-1.5 block h-10 rounded-control border border-line bg-panel px-3 text-sm font-normal" /></label>
                <label className="block text-[13px] font-medium">To<input type="date" value={o.to} min={o.from} onChange={(e) => e.target.value && set({ to: e.target.value })} className="mt-1.5 block h-10 rounded-control border border-line bg-panel px-3 text-sm font-normal" /></label>
              </>)}
              <Select label="Library" value={o.library} onChange={(e) => set({ library: e.target.value as Opts['library'] })} className="w-36"><option value="both">Both</option><option value="jr">{LIBRARIES.jr.label}</option><option value="sr">{LIBRARIES.sr.label}</option></Select>
              {id === 'circulation' && <Select label="Show" value={o.circulation} onChange={(e) => set({ circulation: e.target.value as Opts['circulation'] })} className="w-44"><option value="all">All loans</option><option value="out">Still out</option><option value="overdue">Overdue</option><option value="returned">Returned</option></Select>}
              {id === 'students' && <Select label="Class" value={o.classId} onChange={(e) => set({ classId: e.target.value })} className="w-32"><option value="">All</option>{ALL_CLASSES.map((c) => <option key={c}>{c}</option>)}</Select>}
              {id !== 'students' && id !== 'authors' && <div><p className="mb-1.5 text-[13px] font-medium">Arrange by</p><SegmentedControl label="Arrange by" value={o.arrange} onChange={(v) => set({ arrange: v })} options={[{ value: 'date', label: 'Date' }, { value: 'name', label: id === 'circulation' || id === 'waived' ? 'Name' : 'Title' }, ...(id === 'waived' ? [] : [{ value: 'author' as const, label: 'Author' }])]} /></div>}
            </div>
            {meta.usesRange && <div className="mt-3 flex flex-wrap gap-1.5">{presets.map(([l, fn]) => <button key={l} type="button" onClick={fn} className="h-7 rounded-control border border-line px-2.5 text-xs font-medium text-muted hover:bg-sage-soft hover:text-ink">{l}</button>)}</div>}
            {invalid && <p role="alert" className="mt-3 text-[13px] text-ink">The start date is after the end date.</p>}
          </Panel>

          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted" aria-live="polite"><span className="font-medium text-ink">{invalid ? 0 : built.rows.length}</span> rows{built.rows.length > LIMIT && ` · showing the first ${LIMIT}. Copy or download for the full list.`}</p>
            <div className="flex gap-2"><Button size="sm" icon={<Copy className="size-3.5" aria-hidden />} onClick={copy} disabled={invalid || !built.rows.length}>Copy for spreadsheet</Button><Button size="sm" icon={<Download className="size-3.5" aria-hidden />} onClick={download} disabled={invalid || !built.rows.length}>Download CSV</Button></div>
          </div>
          <Panel>
            {invalid || built.rows.length === 0 ? <p className="px-5 py-14 text-center text-sm text-muted">{invalid ? 'Fix the dates to see the list.' : 'Nothing in this range. Try a wider date range or another library.'}</p> : (
              <div className="max-h-[32rem] overflow-auto"><table className="w-full min-w-max text-left text-[13px]">
                <thead className="sticky top-0 bg-canvas"><tr className="border-b border-line text-[11px] tracking-[0.08em] text-muted uppercase">{built.columns.map((c) => <th key={c} className="px-3 py-2.5 font-medium whitespace-nowrap">{c}</th>)}</tr></thead>
                <tbody>{built.rows.slice(0, LIMIT).map((r, i) => <tr key={i} className="border-b border-line last:border-b-0">{r.map((v, j) => <td key={j} className="px-3 py-2 whitespace-nowrap tabular-nums">{v}</td>)}</tr>)}</tbody>
              </table></div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
