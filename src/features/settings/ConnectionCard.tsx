import { useState } from 'react';
import { CircleCheck, CircleX, Cloud, LogOut } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Checkbox, ErrorList, TextField } from '../../components/ui/Field';
import { LIBRARIES } from '../../domain/rules';
import { signOut, useAuth } from '../../sync/auth';
import { clearConfig, config, DEFAULT_USERNAMES, isConnected, saveConfig } from '../../sync/config';
import { runConnectionTest, type TestResult } from '../../sync/connectionTest';
import { useSyncState } from '../../sync/status';

/** Enter the Supabase project details for this device. */
export function ConnectionSetup({ onDone }: { onDone?: () => void }) {
  const [url, setUrl] = useState(config?.url ?? '');
  const [key, setKey] = useState(config?.anonKey ?? '');
  const [withJr, setWithJr] = useState(config?.libraries.includes('jr') ?? false);
  const [errors, setErrors] = useState<string[]>([]);
  const save = () => {
    const e: string[] = [];
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url.trim())) e.push('The Project URL looks like https://abcdefgh.supabase.co');
    if (key.trim().length < 20) e.push('Paste the anon public key from Supabase (Project Settings > API).');
    setErrors(e);
    if (e.length) return;
    saveConfig({ mode: 'supabase', url: url.trim(), anonKey: key.trim(), libraries: withJr ? ['sr', 'jr'] : ['sr'], usernames: config?.usernames ?? DEFAULT_USERNAMES });
    window.location.reload();
  };
  return (
    <form className="space-y-4 rounded-panel border border-line bg-panel p-5" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <h2 className="flex items-center gap-2 text-base font-semibold"><Cloud className="size-4 text-accent" aria-hidden />Connect to Supabase</h2>
      <ErrorList errors={errors} />
      <TextField label="Project URL" value={url} onChange={setUrl} placeholder="https://abcdefgh.supabase.co" autoComplete="off" />
      <TextField label="Anon public key" value={key} onChange={setKey} placeholder="A long text starting with eyJ…" autoComplete="off" hint="Safe to paste: it only works together with the library password." />
      <Checkbox checked={withJr} onChange={setWithJr} label="The Jr. Library is ready to use" description="Leave this off until the Jr. Library’s books and students are entered and its login exists." />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary">Save and connect</Button>
        {onDone && <Button onClick={onDone}>Back</Button>}
        {!config && <Button variant="ghost" onClick={() => { saveConfig({ mode: 'memory', libraries: ['sr'] }); window.location.reload(); }}>Try sync between tabs (no Supabase)</Button>}
      </div>
    </form>
  );
}

/** Settings card: connection status, test, sign out. */
export function ConnectionCard() {
  const sync = useSyncState();
  const auth = useAuth();
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isConnected) return <ConnectionSetup />;

  const test = async () => { setBusy(true); setResults(null); setResults(await runConnectionTest()); setBusy(false); };
  const label = { connecting: 'Connecting…', live: 'Live. Changes appear on every device.', saving: 'Saving…', offline: 'Offline. Changes will save when the connection is back.', error: sync.detail ?? 'Problem' }[sync.status];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={sync.status === 'live' ? 'sage' : sync.status === 'saving' || sync.status === 'connecting' ? 'neutral' : 'amber'}>{config!.mode === 'memory' ? 'Test mode' : 'Supabase'}</Badge>
        <span className="text-sm">{label}</span>
      </div>
      <p className="text-[13px] text-muted">Signed in to the {auth.session ? LIBRARIES[auth.session.library].label : '…'}. {config!.mode === 'supabase' && <>Project: <span className="font-medium text-ink">{config!.url}</span></>}</p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void test()} loading={busy}>Run connection test</Button>
        <Button icon={<LogOut className="size-4" aria-hidden />} onClick={() => void signOut()}>Sign out</Button>
        <Button variant="ghost" onClick={() => { clearConfig(); window.location.reload(); }}>Disconnect this device</Button>
      </div>
      {results && (
        <ul className="divide-y divide-line rounded-control border border-line">
          {results.map((r) => (
            <li key={r.label} className="flex items-start gap-2.5 px-3 py-2.5 text-sm">
              {r.ok ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden /> : <CircleX className="mt-0.5 size-4 shrink-0 text-amber" aria-hidden />}
              <span><span className="font-medium">{r.label}</span>{!r.ok && r.hint && <span className="block text-[13px] text-muted">{r.hint}</span>}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
