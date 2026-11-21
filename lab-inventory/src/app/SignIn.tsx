import { FlaskConical } from 'lucide-react';
import { useState } from 'react';
import { Button, Field } from '../components/ui';
import { useApplyPrefs } from '../lib/applyPrefs';
import { signIn } from '../sync/auth';
import { config } from '../sync/config';
import { ConnectionSettings } from '../features/settings/ConnectionCard';

export function SignIn() {
  useApplyPrefs();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const r = await signIn(username, password);
    setBusy(false);
    if (!r.ok) setError(r.error ?? 'Could not sign in.');
  };

  return (
    <div className="grid min-h-full place-items-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6 shadow-xl sm:p-8">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#1f2a44] text-white"><FlaskConical className="h-6 w-6" /></span>
          <div><h1 className="text-xl font-semibold tracking-tight">Lab Inventory</h1><p className="text-sm text-muted">Sign in to the shared lab records</p></div>
        </div>
        <Field label="Username"><input className="input" autoFocus autoComplete="username" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. ms-sharma" /></Field>
        <Field label="Password"><input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        {error && <p role="alert" className="rounded-lg tone-red p-2.5 text-sm">{error}</p>}
        <Button variant="primary" type="submit" className="w-full py-2.5" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
        <p className="text-center text-xs text-faint">
          Connected to {config?.mode === 'memory' ? 'the test database' : new URL(config?.url ?? 'https://unknown').host}.{' '}
          <button type="button" className="underline" onClick={() => setSettings(true)}>Connection settings</button>
        </p>
      </form>
      {settings && <ConnectionSettings onClose={() => setSettings(false)} />}
    </div>
  );
}
