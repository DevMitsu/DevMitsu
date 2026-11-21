import { CheckCircle2, Database, LogOut, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Card, Field, Modal } from '../../components/ui';
import { confirmDialog, notify } from '../../components/toast';
import { getAuth } from '../../sync/auth';
import { CONFIG_KEY, checkConfigInput, clearConfig, config, configIsFixed, isConnected, saveConfig } from '../../sync/config';
import { stopSync } from '../../sync/controller';
import { runConnectionTest, type TestResult } from '../../sync/connectionTest';
import { useSyncState } from '../../sync/status';
import { readBeforeSync, replaceState, saveCurrentAsLocal } from '../../store/store';
import { signOutAndReload } from './signOut';

const STATUS_TEXT = { connecting: 'Connecting…', live: 'Live: changes are shared as they happen', saving: 'Saving…', offline: 'Offline: changes will be saved when the connection returns', error: 'Problem' } as const;

/** Connect this computer to a Supabase project, or look after the connection it has. */
export function ConnectionCard() {
  const sync = useSyncState();
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [testing, setTesting] = useState(false);
  const before = !isConnected ? readBeforeSync() : null;

  const test = async () => {
    setTesting(true);
    try { setResults(await runConnectionTest()); } catch (e) { setResults([{ label: 'Run the test', ok: false, hint: e instanceof Error ? e.message : String(e) }]); }
    setTesting(false);
  };

  const disconnect = async () => {
    if (!(await confirmDialog({
      title: 'Disconnect from the shared database?',
      body: 'This computer keeps a copy of the shared data as it is now and carries on on its own. Other computers are not affected, and nothing you change here afterwards reaches them.',
      confirm: 'Disconnect',
    }))) return;
    await stopSync();
    saveCurrentAsLocal();
    clearConfig();
    location.reload();
  };

  return (
    <Card className="lg:col-span-2">
      <div className="mb-1 flex items-center gap-2">
        <Database className="h-5 w-5 text-accent" />
        <h2 className="font-semibold">Shared database</h2>
        {isConnected ? <Badge tone={sync.status === 'live' ? 'green' : sync.status === 'error' ? 'red' : 'amber'}>{sync.status === 'live' ? 'connected' : sync.status}</Badge> : <Badge>not connected</Badge>}
      </div>
      {isConnected ? (
        <>
          <p className="text-sm text-muted">
            This computer shares its data with everyone who signs in to <b>{config?.mode === 'memory' ? 'the test database' : new URL(config?.url ?? 'https://unknown').host}</b>, as <b>{getAuth().session?.username}</b>. {STATUS_TEXT[sync.status]}.
            {sync.detail ? ` ${sync.detail}` : ''}
          </p>
          <p className="mt-2 text-sm text-muted">Everything here, including <b>removing data, erasing and restoring a backup</b>, applies to everyone using the database.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={test} disabled={testing}>{testing ? 'Testing…' : 'Run connection test'}</Button>
            <Button onClick={signOutAndReload}><LogOut className="h-4 w-4" /> Sign out</Button>
            {!configIsFixed && <Button variant="danger" onClick={disconnect}>Disconnect this computer</Button>}
          </div>
          {configIsFixed && <p className="help mt-2">This copy of the app was set up with a config.js file, so the connection can only be changed there.</p>}
          {results && (
            <ul className="mt-3 space-y-1.5 text-sm">
              {results.map((r) => (
                <li key={r.label} className="flex items-start gap-2">
                  {r.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--t-green-fg)]" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--c-danger)]" />}
                  <span>{r.label}{!r.ok && r.hint && <span className="block text-muted">{r.hint}</span>}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <p className="text-sm text-muted">Right now the data lives only in this browser. Connect a free <b>Supabase</b> project and every computer in the school sees the same labs live. Setup takes about 20 minutes and is described in <code>docs/SETUP-SUPABASE.md</code>. When you connect, this computer's data becomes the shared data if the database is empty.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => setOpen(true)}>Connect to Supabase…</Button>
            {before && (
              <Button onClick={async () => {
                if (await confirmDialog({ title: 'Restore the data this computer had before it was connected?', body: `That copy holds ${before.items.length} items and ${before.records.length} log entries. It replaces what this computer has now.`, confirm: 'Restore' })) { replaceState(before); notify('Restored', 'info'); }
              }}>Restore what this computer had before</Button>
            )}
          </div>
        </>
      )}
      {open && <ConnectionSettings onClose={() => setOpen(false)} />}
    </Card>
  );
}

/** Enter (or change) the Supabase URL and key. Used from the card above and from the sign-in screen. */
export function ConnectionSettings({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState(config?.url ?? '');
  const [key, setKey] = useState('');
  const [error, setError] = useState('');

  const save = () => {
    const keyToUse = key.trim() || config?.anonKey || '';
    const problem = checkConfigInput(url, keyToUse);
    if (problem) { setError(problem); return; }
    saveConfig({ mode: 'supabase', url: url.trim().replace(/\/+$/, ''), anonKey: keyToUse });
    location.reload();
  };

  return (
    <Modal size="sm" title="Connection settings" sub="From Supabase: Project Settings → API." onClose={onClose}
      footer={<>
        {config && !configIsFixed && <Button variant="danger" className="mr-auto" onClick={() => { localStorage.removeItem(CONFIG_KEY); location.reload(); }}>Remove connection</Button>}
        <Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save and connect</Button></>}>
      {configIsFixed ? <p className="text-sm text-muted">This copy was set up with a config.js file. Change the connection there.</p> : (
        <div className="grid gap-3">
          <Field label="Project URL" help="Looks like https://abcdefgh.supabase.co"><input className="input" autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://abcdefgh.supabase.co" /></Field>
          <Field label="Anon public key" help={config ? 'Leave blank to keep the saved key' : 'The long text under “anon public”. Never use the service_role key.'}><textarea className="input min-h-24 font-mono text-xs" value={key} onChange={(e) => setKey(e.target.value)} /></Field>
          {error && <p role="alert" className="rounded-lg tone-red p-2.5 text-sm">{error}</p>}
        </div>
      )}
    </Modal>
  );
}
