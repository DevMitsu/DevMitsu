import { useState } from 'react';
import { KeyRound, Lock, LockOpen } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { ErrorList, TextField } from '../../components/ui/Field';
import { Panel } from '../../components/ui/Panel';
import { PageHeader } from '../../components/ui/PageHeader';
import { notify, toast } from '../../components/ui/toast';
import { LIBRARIES } from '../../domain/rules';
import { setLibrarianName } from '../../store/actions';
import { changeLibraryPassword, useAuth, verifyPassword } from '../../sync/auth';
import { isConnected } from '../../sync/config';
import { signOutTo } from '../../app/AppGate';
import { useStore } from '../../store/store';

export function ProfilePage() {
  const auth = useAuth();
  const lib = auth.session?.library ?? 'sr';
  const names = useStore((s) => s.names);
  const [pw, setPw] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState(names[lib]);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwErrors, setPwErrors] = useState<string[]>([]);

  const unlock = async () => {
    if (!(await verifyPassword(pw))) return setError('That password is not correct.');
    setError(''); setUnlocked(true); setPw('');
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title="Profile" description="Enter your password to edit your name or change the password." />
      <Panel className="mb-6">
        <div className="space-y-5 p-5">
          <p className="text-sm">Signed in to the <span className="font-semibold">{LIBRARIES[lib].label}</span> as <span className="font-semibold">{auth.session?.username}</span>. <button type="button" onClick={() => void signOutTo()} className="font-medium text-accent underline underline-offset-2">Sign out</button></p>

          <form className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); void unlock(); }}>
            <TextField label="Password" type="password" value={pw} onChange={(v) => { setPw(v); setError(''); }} error={error} disabled={unlocked} autoComplete="off" hint={isConnected ? undefined : `Demo password: ${lib}123`} />
            {unlocked ? <Button variant="secondary" icon={<LockOpen className="size-4" aria-hidden />} onClick={() => { setUnlocked(false); setPwErrors([]); }}>Lock</Button> : <Button type="submit" variant="primary" icon={<Lock className="size-4" aria-hidden />}>Unlock</Button>}
          </form>

          <form className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); setLibrarianName(lib, name); toast('Name saved.'); }}>
            <TextField label="Your name" value={name} onChange={setName} disabled={!unlocked} hint={unlocked ? 'Shown in the greeting and the top bar.' : 'Enter the password to edit your name.'} />
            <Button type="submit" variant="primary" disabled={!unlocked || !name.trim()}>Save name</Button>
          </form>
        </div>
      </Panel>

      <Panel>
        <div className="border-b border-line bg-canvas px-5 py-3"><h2 className="flex items-center gap-2 text-base font-semibold"><KeyRound className="size-4 text-accent" aria-hidden />Change password</h2><p className="mt-0.5 text-[13px] text-muted">Each library has its own password. Changing it needs the old one.</p></div>
        <form className="space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); void (async () => { const r = await changeLibraryPassword(oldPw, newPw, confirmPw); setPwErrors(r.errors); if (notify({ ok: r.ok, errors: r.errors }, `Password for the ${LIBRARIES[lib].label} changed.`)) { setOldPw(''); setNewPw(''); setConfirmPw(''); } })(); }}>
          <ErrorList errors={pwErrors} />
          <TextField label="Old password" type="password" value={oldPw} onChange={setOldPw} disabled={!unlocked} autoComplete="off" />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="New password" type="password" value={newPw} onChange={setNewPw} disabled={!unlocked} autoComplete="off" hint={isConnected ? 'At least 6 characters' : 'At least 4 characters'} />
            <TextField label="Confirm new password" type="password" value={confirmPw} onChange={setConfirmPw} disabled={!unlocked} autoComplete="off" />
          </div>
          <div className="flex items-center gap-3"><Button type="submit" variant="primary" disabled={!unlocked || !oldPw || !newPw}>Change password</Button>{!unlocked && <span className="text-[13px] text-muted">Unlock above first.</span>}</div>
        </form>
      </Panel>
      <p className="mt-4 text-xs text-muted">{isConnected ? 'Passwords are checked by the shared database, and are never stored in this page.' : 'This demo checks passwords in the browser, which is not secure. Connect to the shared database in Settings for real sign-in.'}</p>
    </div>
  );
}
