import { Download, RotateCcw, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button, Card } from '../../components/ui';
import { attempt, confirmDialog, notify, tryDo } from '../../components/toast';
import { download, toCSV } from '../../domain/csv';
import { daysBetween, fmtDateTime, todayStr } from '../../domain/dates';
import type { AppState } from '../../domain/types';
import { clearData, resetEverything } from '../../store/actions';
import { STORAGE_LIMIT_CHARS, exportJSON, replaceState, useMeta, useStore } from '../../store/store';
import { isConnected } from '../../sync/config';
import { ConnectionCard } from './ConnectionCard';
import { downloadBackup } from './backup';

export function DataTab() {
  const state = useStore((s) => s);
  const file = useRef<HTMLInputElement>(null);
  const [showLog, setShowLog] = useState(false);
  const meta = useMeta();
  const kb = Math.round(exportJSON().length / 1024);
  const pct = Math.min(100, Math.round((meta.usedChars / STORAGE_LIMIT_CHARS) * 100));
  const age = state.settings.lastBackupAt ? daysBetween(state.settings.lastBackupAt.slice(0, 10), todayStr()) : null;

  const restore = async (f?: File) => {
    if (!f) return;
    let data: AppState;
    try {
      data = JSON.parse(await f.text()) as AppState;
      if (!Array.isArray(data.items) || !Array.isArray(data.labs) || !Array.isArray(data.modules)) throw new Error('shape');
    } catch {
      notify('That file is not a Lab Inventory backup.', 'error');
      return;
    }
    const ok = await confirmDialog({
      title: isConnected ? 'Replace the shared data with this backup, for everyone?' : 'Replace everything with this backup?',
      body: <>This backup holds <b>{data.items.length}</b> items, <b>{data.records?.length ?? 0}</b> log entries and <b>{data.labs.length}</b> labs. Everything currently in the app is replaced. Download a backup of the current data first if you might want it back.</>,
      confirm: 'Replace with backup', danger: true, typed: isConnected ? 'REPLACE' : undefined,
    });
    if (ok) attempt(() => replaceState({ ...data, setupDone: true }), 'Backup restored');
  };

  const exportAllItems = () => {
    const head = ['Lab', 'Code', 'Name', 'Category', 'Quantity', 'Unit', 'Location', 'Status', 'Reorder level', 'Supplier', 'Unit cost', 'Expiry', 'Lot', 'Hazards', 'Storage group'];
    download(`all-items-${todayStr()}.csv`, toCSV(head, state.items.map((i) => [state.labs.find((l) => l.id === i.labId)?.name, i.code, i.name, state.categories.find((c) => c.id === i.categoryId)?.name, i.quantity, i.unit, i.location ?? '', i.status, i.minStock ?? '', i.supplier ?? '', i.unitCost ?? '', i.expiry ?? '', i.lot ?? '', (i.hazards ?? []).join('; '), i.storageGroup ?? ''])));
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ConnectionCard />

      {!isConnected && <Card className="lg:col-span-2">
        <h2 className="mb-1 font-semibold">Where your data lives</h2>
        <p className="text-sm text-muted">Everything is stored <b>in this browser on this computer</b>: about {kb} KB so far ({pct}% of what the browser allows), with {state.items.length} items and {state.records.length} log entries. As a guide, every 2,000 log entries take about 1 MB. Nothing is sent anywhere. That keeps it private and working offline, but it also means clearing the browser's site data, or using another computer, would not bring it along. <b>A backup file is your safety net.</b></p>
      </Card>}

      <Card>
        <h2 className="mb-1 font-semibold">Backup</h2>
        <p className="mb-3 text-sm text-muted">{age === null ? 'You have not downloaded a backup yet.' : age === 0 ? 'Last backup: today.' : `Last backup: ${age} days ago.`} Keep the file somewhere safe (a school drive or a pendrive). The same file moves your data to another computer.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => { downloadBackup(); notify('Backup downloaded', 'info'); }}><Download className="h-4 w-4" /> Download backup</Button>
          <Button onClick={() => file.current?.click()}><Upload className="h-4 w-4" /> Restore from a backup…</Button>
          <input ref={file} type="file" accept=".json,application/json" className="hidden" onChange={(e) => { restore(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">Export for Excel</h2>
        <p className="mb-3 text-sm text-muted">The full inventory of every lab as one spreadsheet. Individual logs and reports have their own Download buttons.</p>
        <Button onClick={exportAllItems}><Download className="h-4 w-4" /> Download all items (CSV)</Button>
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">Start with your own data</h2>
        <p className="mb-3 text-sm text-muted">Remove every item, log entry, practical, person and supplier. Your labs, categories, forms, lists and settings stay exactly as you customised them.</p>
        <Button variant="danger" onClick={async () => { if (await confirmDialog({ title: isConnected ? 'Remove all items and logs for everyone?' : 'Remove all items and logs?', body: isConnected ? 'Every computer sharing this database loses them. Your customisation is kept. Download a backup first.' : 'Your customisation is kept. Download a backup first if you might want the data again.', confirm: 'Remove data', danger: true, typed: isConnected ? 'REMOVE' : undefined })) tryDo(() => clearData(), 'All data removed'); }}><Trash2 className="h-4 w-4" /> Remove all data, keep customisation</Button>
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">Start completely over</h2>
        <p className="mb-3 text-sm text-muted">Erases everything, including labs, categories and forms, and shows the first-time setup again.</p>
        <Button variant="danger" onClick={async () => { if (await confirmDialog({ title: isConnected ? 'Erase the shared database for everyone?' : 'Erase everything?', body: isConnected ? 'All data and all customisation is deleted from the shared database and from every computer using it. Download a backup first.' : 'All data and all customisation will be lost for good. Download a backup first.', confirm: 'Erase everything', danger: true, typed: isConnected ? 'ERASE' : undefined })) resetEverything(); }}><RotateCcw className="h-4 w-4" /> Erase everything</Button>
      </Card>

      <Card className="lg:col-span-2" pad={false}>
        <button className="flex w-full items-center justify-between px-4 py-3 text-left font-semibold" onClick={() => setShowLog((s) => !s)} aria-expanded={showLog}>Activity log <span className="text-sm font-normal text-muted">{state.activity.length} recent changes · {showLog ? 'hide' : 'show'}</span></button>
        {showLog && (
          <div className="max-h-96 overflow-auto border-t">
            <table className="tbl"><thead><tr><th>When</th><th>Who</th><th>What</th></tr></thead>
              <tbody>{state.activity.slice(0, 200).map((a) => <tr key={a.id}><td className="whitespace-nowrap">{fmtDateTime(a.at)}</td><td className="text-muted">{a.by ?? ''}</td><td>{a.text}</td></tr>)}</tbody></table>
          </div>
        )}
      </Card>
    </div>
  );
}
