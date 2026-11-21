import { Download, Plus, Printer } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { tryDo } from '../../components/toast';
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader, SearchBox, Stat, cx } from '../../components/ui';
import { download, toCSV } from '../../domain/csv';
import { daysBetween, fmtDate, todayStr } from '../../domain/dates';
import { num } from '../../domain/fields';
import { ALL, labOf } from '../../domain/inventory';
import { breakageModuleId, fineStatusOf, fineTotals, finedRecords, type FineStatus } from '../../domain/fines';
import type { LabRecord } from '../../domain/types';
import { scopePath, useScope } from '../../lib/scope';
import { openRecord } from '../../lib/ui';
import { setFine } from '../../store/actions';
import { useStore } from '../../store/store';

type Chip = 'all' | FineStatus;

export function FinesPage() {
  const { scope, lab } = useScope();
  const state = useStore((s) => s);
  const [q, setQ] = useState('');
  const [chip, setChip] = useState<Chip>('Pending');
  const [dlg, setDlg] = useState<{ rec: LabRecord; mode: 'Paid' | 'Waived' } | null>(null);
  const cur = state.settings.currency;
  const money = (n: number) => `${cur}${Math.round(n * 100) / 100}`.replace(/\.0+$/, '');
  const modId = breakageModuleId(state);
  const mod = state.modules.find((m) => m.id === modId);
  const today = todayStr();

  const all = useMemo(() => finedRecords(state).filter((r) => scope === ALL || r.labId === scope), [state, scope]);
  const totals = useMemo(() => fineTotals(all), [all]);
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return all
      .filter((r) => (chip === 'all' || fineStatusOf(r) === chip) && (!t || `${r.values.who ?? ''} ${r.values.class ?? ''} ${state.items.find((i) => i.id === r.values.item)?.name ?? ''} ${r.values.fineNote ?? ''}`.toLowerCase().includes(t)))
      .sort((a, b) => String(b.values.date ?? '').localeCompare(String(a.values.date ?? '')));
  }, [all, chip, q, state.items]);

  // Who owes what: one line per person, outstanding fines only
  const owing = useMemo(() => {
    const m = new Map<string, { who: string; cls: string; total: number; n: number }>();
    for (const r of all) {
      if (fineStatusOf(r) !== 'Pending') continue;
      const who = String(r.values.who ?? '').trim() || '(name not recorded)';
      const e = m.get(who) ?? { who, cls: String(r.values.class ?? ''), total: 0, n: 0 };
      e.total += num(r.values.fine) ?? 0;
      e.n++;
      if (!e.cls && r.values.class) e.cls = String(r.values.class);
      m.set(who, e);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [all]);

  const exportCsv = () => download(`fines-${today}.csv`, toCSV(['Date', 'Lab', 'Item', 'Quantity', 'Broken by', 'Class', 'Fine', 'Status', 'Paid on', 'Note'],
    rows.map((r) => [fmtDate(String(r.values.date ?? '')), labOf(state, r.labId)?.name, state.items.find((i) => i.id === r.values.item)?.name ?? '', num(r.values.quantity) ?? '', r.values.who ?? '', r.values.class ?? '', num(r.values.fine) ?? '', fineStatusOf(r), r.values.finePaidOn ? fmtDate(String(r.values.finePaidOn)) : '', r.values.fineNote ?? ''])));

  if (!mod || !mod.enabled) {
    return <Card><EmptyState icon="coins" title="Fines come from the Breakage & loss log">That log is switched off. Switch it on under Customise → Forms &amp; logs.</EmptyState></Card>;
  }
  const chips: { id: Chip; label: string; n: number }[] = [
    { id: 'Pending', label: 'To collect', n: all.filter((r) => fineStatusOf(r) === 'Pending').length },
    { id: 'Paid', label: 'Paid', n: all.filter((r) => fineStatusOf(r) === 'Paid').length },
    { id: 'Waived', label: 'Waived', n: all.filter((r) => fineStatusOf(r) === 'Waived').length },
    { id: 'all', label: 'All', n: all.length },
  ];

  return (
    <div>
      <PageHeader icon="coins" title={`Fines${lab ? ` · ${lab.name}` : ''}`}
        sub="Charged to whoever broke or lost equipment. Add a fine when you log the breakage; collect it, or waive it with a reason, here."
        actions={<><Button onClick={exportCsv}><Download className="h-4 w-4" /> Export</Button><Button onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button><Button variant="primary" onClick={() => openRecord(mod.id, { labId: lab?.id })}><Plus className="h-4 w-4" /> New breakage with fine</Button></>} />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Stat label="To collect" value={money(totals.pending)} sub={`${chips[0].n} fine${chips[0].n === 1 ? '' : 's'}`} tone={totals.pending ? 'amber' : 'green'} icon="coins" />
        <Stat label="Collected" value={money(totals.paid)} sub={`${chips[1].n} paid`} tone="green" />
        <Stat label="Waived" value={money(totals.waived)} sub={`${chips[2].n} waived`} />
      </div>

      {owing.length > 0 && (
        <Card className="mb-4 print:hidden">
          <h2 className="mb-2 font-semibold">Who owes</h2>
          <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {owing.slice(0, 9).map((o) => (
              <li key={o.who} className="flex items-baseline justify-between gap-3 text-sm"><span className="truncate">{o.who}{o.cls && <span className="text-muted"> · {o.cls}</span>}</span><b className="tabular-nums">{money(o.total)}</b></li>
            ))}
          </ul>
          {owing.length > 9 && <p className="help mt-2">…and {owing.length - 9} more</p>}
        </Card>
      )}

      <div className="no-print mb-3 flex flex-wrap items-center gap-2">
        <SearchBox value={q} onChange={setQ} placeholder="Search name, class, item…" className="w-full sm:w-72" />
        {chips.map((c) => (
          <button key={c.id} onClick={() => setChip(c.id)} aria-pressed={chip === c.id} className={cx('rounded-full border px-3 py-1 text-xs font-medium', chip === c.id ? 'border-accent bg-accent-soft text-accent' : 'bg-surface text-muted hover:text-ink')}>{c.label}<span className="ml-1 opacity-70">{c.n}</span></button>
        ))}
      </div>

      <Card pad={false} className="print-area overflow-x-auto">
        {rows.length === 0 ? (
          <EmptyState icon="coins" title={all.length === 0 ? 'No fines yet' : 'Nothing here'}>
            {all.length === 0 ? <>When you log a breakage, fill in <b>Fine charged</b> (a suggested amount is offered from the item's cost) and it appears here.</> : 'Try another filter.'}
          </EmptyState>
        ) : (
          <table className="tbl">
            <thead><tr>{scope === ALL && <th>Lab</th>}<th>Date</th><th>Item</th><th>Broken by</th><th className="text-right">Fine</th><th>Status</th><th className="no-print" /></tr></thead>
            <tbody>
              {rows.map((r) => {
                const st = fineStatusOf(r);
                const age = daysBetween(String(r.values.date ?? today), today);
                const l = labOf(state, r.labId);
                const item = state.items.find((i) => i.id === r.values.item);
                return (
                  <tr key={r.id} className="clickable" onClick={() => openRecord(mod.id, { id: r.id })}>
                    {scope === ALL && <td><span className="inline-flex items-center gap-1.5 text-muted"><span className="h-2 w-2 rounded-full" style={{ background: l?.color }} />{l?.short}</span></td>}
                    <td className="whitespace-nowrap">{fmtDate(String(r.values.date ?? ''))}{st === 'Pending' && age >= state.settings.fineUnpaidDays && <div className="text-xs text-[var(--t-red-fg)]">{age} days ago</div>}</td>
                    <td>{item ? <Link className="font-medium hover:underline" to={scopePath(scope === ALL ? r.labId : scope, `items/${item.id}`)} onClick={(e) => e.stopPropagation()}>{item.name}</Link> : '—'}<span className="text-muted"> × {num(r.values.quantity) ?? 1}</span></td>
                    <td>{String(r.values.who ?? '') || <span className="text-faint">—</span>}{r.values.class ? <span className="text-muted"> · {String(r.values.class)}</span> : null}</td>
                    <td className="text-right font-semibold tabular-nums">{money(num(r.values.fine) ?? 0)}</td>
                    <td>
                      <Badge tone={st === 'Paid' ? 'green' : st === 'Waived' ? 'gray' : 'amber'}>{st}</Badge>
                      {st === 'Paid' && r.values.finePaidOn ? <span className="ml-1.5 text-xs text-muted">{fmtDate(String(r.values.finePaidOn))}</span> : null}
                      {r.values.fineNote ? <div className="max-w-56 truncate text-xs text-muted" title={String(r.values.fineNote)}>{String(r.values.fineNote)}</div> : null}
                    </td>
                    <td className="no-print text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {st === 'Pending' ? (<><Button size="sm" variant="primary" onClick={() => setDlg({ rec: r, mode: 'Paid' })}>Mark paid</Button> <Button size="sm" onClick={() => setDlg({ rec: r, mode: 'Waived' })}>Waive</Button></>)
                        : <Button size="sm" variant="ghost" onClick={() => tryDo(() => setFine(r.id, 'Pending'), 'Fine reopened')}>Reopen</Button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
      {dlg && <FineDialog rec={dlg.rec} mode={dlg.mode} onClose={() => setDlg(null)} />}
    </div>
  );
}

function FineDialog({ rec, mode, onClose }: { rec: LabRecord; mode: 'Paid' | 'Waived'; onClose: () => void }) {
  const cur = useStore((s) => s.settings.currency);
  const item = useStore((s) => s.items.find((i) => i.id === rec.values.item));
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState(String(rec.values.fineNote ?? ''));
  const paid = mode === 'Paid';
  return (
    <Modal size="sm" title={paid ? 'Mark fine as paid' : 'Waive this fine'} sub={`${cur}${num(rec.values.fine)} · ${String(rec.values.who ?? 'name not recorded')} · ${item?.name ?? 'item'}`} onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!paid && !note.trim()} onClick={() => tryDo(() => setFine(rec.id, mode, { date, note }), paid ? 'Marked as paid' : 'Fine waived') && onClose()}>{paid ? 'Mark paid' : 'Waive fine'}</Button></>}>
      <div className="grid gap-3">
        {paid && <Field label="Paid on"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} autoFocus /></Field>}
        <Field label={paid ? 'Receipt or note' : 'Reason for waiving'} required={!paid} help={paid ? 'Optional, e.g. receipt number' : 'Kept with the fine, so the record shows why'}>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} autoFocus={!paid} placeholder={paid ? 'Receipt no. 1042' : 'e.g. Faulty beaker, accident not the student’s fault'} />
        </Field>
      </div>
    </Modal>
  );
}
