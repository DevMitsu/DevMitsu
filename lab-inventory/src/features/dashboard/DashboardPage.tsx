import { ArrowRight, Download, Plus } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarList, ColumnChart } from '../../components/charts';
import { Icon } from '../../components/icons';
import { confirmDialog, tryDo } from '../../components/toast';
import { Badge, Button, Card, PageHeader, Stat } from '../../components/ui';
import { ALERT_LABEL } from '../../domain/alerts';
import { addDays, daysBetween, fmtDate, fmtDateTime, todayStr } from '../../domain/dates';
import { ALL, activeLabs, isLow, outOnLoan, stockValue } from '../../domain/inventory';
import { useAlerts } from '../../lib/alerts';
import { scopePath, useScope } from '../../lib/scope';
import { openItem, openRecord, setUi } from '../../lib/ui';
import { clearData } from '../../store/actions';
import { useStore } from '../../store/store';
import { recordDay } from '../records/helpers';
import { isConnected } from '../../sync/config';
import { downloadBackup } from '../settings/backup';

export function DashboardPage() {
  const { scope, lab } = useScope();
  const state = useStore((s) => s);
  const alerts = useAlerts(scope);
  const navigate = useNavigate();
  const today = todayStr();
  const to = (p: string) => navigate(scopePath(scope, p));

  const items = useMemo(() => state.items.filter((i) => !i.archived && (scope === ALL || i.labId === scope)), [state.items, scope]);
  const records = useMemo(() => state.records.filter((r) => scope === ALL || r.labId === scope), [state.records, scope]);
  const out = useMemo(() => outOnLoan(records), [records]);
  const count = (k: string[]) => alerts.filter((a) => k.includes(a.kind)).length;

  const value = items.reduce((n, i) => n + stockValue(i), 0);
  const low = items.filter(isLow).length;
  const loansOut = [...out.values()].reduce((a, b) => a + b, 0);
  const incidents = records.filter((r) => state.modules.find((m) => m.id === r.moduleId)?.kind === 'incident');
  const lastAccident = incidents.filter((r) => r.values.type !== 'Near miss').map((r) => String(r.values.when ?? '').slice(0, 10)).filter(Boolean).sort().pop();
  const openReq = records.filter((r) => state.modules.find((m) => m.id === r.moduleId)?.kind === 'requisition' && !['Received', 'Rejected', 'Cancelled'].includes(String(r.values.status ?? ''))).length;

  // Usage entries per week, last 8 weeks (oldest first)
  const usageMod = state.modules.find((m) => m.kind === 'usage');
  const weeks = useMemo(() => {
    const start = addDays(today, -7 * 7 - ((new Date().getDay() + 6) % 7)); // Monday 7 weeks back
    const out: { label: string; value: number; sub: string }[] = [];
    for (let w = 0; w < 8; w++) {
      const a = addDays(start, w * 7);
      const b = addDays(a, 6);
      const n = records.filter((r) => r.moduleId === usageMod?.id && recordDay(usageMod, r) >= a && recordDay(usageMod, r) <= b).length;
      out.push({ label: fmtDate(a).slice(0, -5), value: n, sub: `Week of ${fmtDate(a)}` });
    }
    return out;
  }, [records, usageMod, today]);

  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) m.set(i.categoryId, (m.get(i.categoryId) ?? 0) + 1);
    return [...m.entries()].map(([id, value]) => ({ label: state.categories.find((c) => c.id === id)?.name ?? id, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [items, state.categories]);

  const activity = state.activity.filter((a) => scope === ALL || !a.labId || a.labId === scope).slice(0, 8);
  const quick = (['usage', 'incident', 'spill', 'breakage', 'loan', 'requisition'] as const)
    .map((k) => state.modules.find((m) => m.kind === k && m.enabled && (m.labIds.length === 0 || scope === ALL || m.labIds.includes(scope))))
    .filter((m): m is NonNullable<typeof m> => !!m);

  const backupAge = state.settings.lastBackupAt ? daysBetween(state.settings.lastBackupAt.slice(0, 10), today) : null;
  const needBackup = !state.sample && state.items.length > 0 && (backupAge === null || backupAge >= 14);

  return (
    <div>
      <PageHeader title={lab ? lab.name : 'All labs'} icon={lab?.icon ?? 'atom'} sub={`${state.settings.schoolName} · ${fmtDate(today)}${lab?.incharge ? ` · In charge: ${lab.incharge}` : ''}`}
        actions={<Button variant="primary" onClick={() => openItem({ labId: lab?.id })}><Plus className="h-4 w-4" /> Add item</Button>} />

      {state.sample && (
        <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl tone-blue p-3 text-sm">
          <span><b>You are looking at sample data.</b> Explore freely, then clear it to start with your own lab. Your labs, categories, forms and lists are kept.</span>
          <Button size="sm" onClick={async () => { if (await confirmDialog({ title: 'Clear the sample data?', body: isConnected ? 'All sample items, logs, practicals and people are removed for everyone sharing this database. Your customisation stays.' : 'All sample items, logs, practicals and people are removed. Your customisation stays.', confirm: 'Clear sample data', danger: true })) tryDo(() => clearData(), 'Sample data cleared'); }}>Clear sample data</Button>
        </div>
      )}
      {needBackup && (
        <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl tone-amber p-3 text-sm">
          <span><b>{backupAge === null ? 'No backup yet.' : `Last backup was ${backupAge} days ago.`}</b> This app keeps its data in this browser, so a backup file is your safety net.</span>
          <Button size="sm" onClick={downloadBackup}><Download className="h-3.5 w-3.5" /> Download backup</Button>
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Stat label="Items" value={items.length} sub={value ? `Worth ${state.settings.currency}${Math.round(value).toLocaleString('en-IN')}` : undefined} icon="boxes" to={() => to('items')} />
        <Stat label="Low or out of stock" value={low} tone={low ? 'amber' : 'green'} to={() => to('items?f=low')} icon="package" />
        <Stat label="Expired / expiring" value={count(['expired', 'expiring'])} tone={count(['expired']) ? 'red' : count(['expiring']) ? 'amber' : 'green'} sub={count(['expired']) ? `${count(['expired'])} already expired` : undefined} to={() => to('items?f=expiry')} icon="calendar" />
        <Stat label="Out on loan" value={loansOut} sub={count(['loan-overdue']) ? `${count(['loan-overdue'])} overdue` : 'None overdue'} tone={count(['loan-overdue']) ? 'red' : undefined} to={() => to('m/loan')} icon="swap" />
        <Stat label="Open requirements" value={openReq} to={() => to('m/requisition')} icon="cart" />
        <Stat label="Days since last accident" value={lastAccident ? Math.max(0, daysBetween(lastAccident, today)) : '—'} sub={`${count(['accident-open'])} open follow-ups`} tone={count(['accident-open']) ? 'amber' : 'green'} to={() => to('m/incident')} icon="siren" />
      </div>

      {scope === ALL && (
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {activeLabs(state).map((l) => {
            const li = state.items.filter((i) => i.labId === l.id && !i.archived);
            const la = alerts.filter((a) => a.labId === l.id);
            return (
              <Link key={l.id} to={scopePath(l.id)} className="card block p-4 hover:bg-surface2" style={{ borderTop: `4px solid ${l.color}` }}>
                <div className="flex items-center gap-2 font-semibold"><Icon name={l.icon} className="h-5 w-5" style={{ color: l.color }} />{l.name}<ArrowRight className="ml-auto h-4 w-4 text-faint" /></div>
                <div className="mt-2 flex gap-4 text-sm text-muted"><span><b className="text-ink">{li.length}</b> items</span><span><b className="text-ink">{la.filter((a) => a.severity === 'high').length}</b> urgent</span><span><b className="text-ink">{la.length}</b> alerts</span></div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" pad={false}>
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="font-semibold">Needs attention</h2>
            <Link className="text-sm text-accent hover:underline" to={scopePath(scope, 'alerts')}>All {alerts.length} alerts</Link>
          </div>
          {alerts.length === 0 ? <p className="p-6 text-center text-sm text-muted">Nothing needs attention right now. 🎉</p> : (
            <ul className="divide-y">
              {alerts.slice(0, 7).map((a) => (
                <li key={a.id}>
                  <Link to={scopePath(a.labId === scope ? scope : scope === ALL ? a.labId : scope, a.to)} className="flex items-start gap-3 px-4 py-2.5 hover:bg-surface2">
                    <Badge tone={a.severity === 'high' ? 'red' : a.severity === 'medium' ? 'amber' : 'gray'} className="mt-0.5 shrink-0">{ALERT_LABEL[a.kind]}</Badge>
                    <span className="min-w-0 text-sm"><span className="block font-medium">{a.title}</span><span className="block text-muted">{a.detail}</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <h2 className="mb-3 font-semibold">Quick actions</h2>
            <div className="grid grid-cols-2 gap-2">
              {quick.map((m) => <Button key={m.id} className="justify-start" onClick={() => openRecord(m.id, { labId: lab?.id })}><Icon name={m.icon} className="h-4 w-4 text-accent" /> {m.singular}</Button>)}
              <Button className="justify-start" onClick={() => setUi({ importLab: lab?.id ?? activeLabs(state)[0]?.id })}><Icon name="file" className="h-4 w-4 text-accent" /> Import items</Button>
            </div>
          </Card>
          <Card>
            <h2 className="mb-3 font-semibold">Recent activity</h2>
            {activity.length === 0 ? <p className="text-sm text-muted">Changes you make will be listed here.</p> : (
              <ul className="space-y-2">
                {activity.map((a) => <li key={a.id} className="text-sm"><span className="block">{a.text}</span><span className="text-xs text-faint">{fmtDateTime(a.at)}{a.by ? ` · ${a.by}` : ''}</span></li>)}
              </ul>
            )}
          </Card>
        </div>

        <Card>
          <h2 className="font-semibold">Usage entries per week</h2>
          <p className="mb-2 text-xs text-muted">How often stock was logged as used, last 8 weeks</p>
          {usageMod ? <ColumnChart data={weeks} title="Usage entries per week" /> : <p className="text-sm text-muted">The usage log is switched off.</p>}
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="mb-3 font-semibold">Items by category</h2>
          {byCat.length ? <BarList data={byCat} title="Items by category" /> : <p className="text-sm text-muted">Add items to see this chart.</p>}
        </Card>
      </div>
    </div>
  );
}
