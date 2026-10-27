import { useState } from 'react';
import { KeyRound, Lock, LockOpen } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { ErrorList, TextField } from '../../components/ui/Field';
import { Panel } from '../../components/ui/Panel';
import { PageHeader } from '../../components/ui/PageHeader';
import { notify, toast } from '../../components/ui/toast';
import { LIBRARIES } from '../../domain/rules';
import type { LibraryId } from '../../domain/types';
import { cn } from '../../lib/cn';
import { changePassword, checkPassword, setLibrarianName, switchLibrary } from '../../store/actions';
import { useStore } from '../../store/store';

export function ProfilePage() {
  const active = useStore((s) => s.activeLibrary);
  const names = useStore((s) => s.names);
  const [lib, setLib] = useState<LibraryId>(active);
  const [pw, setPw] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState(names[active]);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwErrors, setPwErrors] = useState<string[]>([]);

  const choose = (l: LibraryId) => { setLib(l); setUnlocked(false); setPw(''); setError(''); setName(names[l]); setPwErrors([]); };
  const unlock = () => {
    if (!checkPassword(lib, pw)) return setError('That password is not correct.');
    setError(''); setUnlocked(true); setPw('');
    if (lib !== active) { switchLibrary(lib); toast(`Now working in the ${LIBRARIES[lib].label}.`); }
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title="Profile" description="Choose your library, enter its password, then you can edit your name or change the password." />
      <Panel className="mb-6">
        <div className="space-y-5 p-5">
          <fieldset>
            <legend className="mb-1.5 text-[13px] font-medium">Library</legend>
            <div className="flex flex-wrap gap-2">
              {(['jr', 'sr'] as LibraryId[]).map((l) => (
                <label key={l} className={cn('flex cursor-pointer items-center gap-2 rounded-control border px-4 py-2.5 text-sm font-medium', lib === l ? 'border-primary bg-sage-soft' : 'border-line hover:bg-sage-soft')}>
                  <input type="radio" name="library" checked={lib === l} onChange={() => choose(l)} className="accent-[var(--color-primary)]" />{LIBRARIES[l].label}
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted">Currently working in the {LIBRARIES[active].label}.</p>
          </fieldset>

          <form className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); unlock(); }}>
            <TextField label={`Password for the ${LIBRARIES[lib].label}`} type="password" value={pw} onChange={(v) => { setPw(v); setError(''); }} error={error} disabled={unlocked} autoComplete="off" hint="Demo passwords: jr123 and sr123" />
            {unlocked ? <Button variant="secondary" icon={<LockOpen className="size-4" aria-hidden />} onClick={() => choose(lib)}>Lock</Button> : <Button type="submit" variant="primary" icon={<Lock className="size-4" aria-hidden />}>Unlock</Button>}
          </form>

          <form className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); setLibrarianName(lib, name); toast('Name saved.'); }}>
            <TextField label="Your name" value={name} onChange={setName} disabled={!unlocked} hint={unlocked ? 'Shown in the greeting and the top bar.' : 'Enter the password to edit your name.'} />
            <Button type="submit" variant="primary" disabled={!unlocked || !name.trim()}>Save name</Button>
          </form>
        </div>
      </Panel>

      <Panel>
        <div className="border-b border-line bg-canvas px-5 py-3"><h2 className="flex items-center gap-2 text-base font-semibold"><KeyRound className="size-4 text-primary" aria-hidden />Change password</h2><p className="mt-0.5 text-[13px] text-muted">There is one password per library. Changing it needs the old one.</p></div>
        <form className="space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); const r = changePassword(lib, oldPw, newPw, confirmPw); setPwErrors(r.errors); if (notify(r, `Password for the ${LIBRARIES[lib].label} changed.`)) { setOldPw(''); setNewPw(''); setConfirmPw(''); } }}>
          <ErrorList errors={pwErrors} />
          <TextField label="Old password" type="password" value={oldPw} onChange={setOldPw} disabled={!unlocked} autoComplete="off" />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="New password" type="password" value={newPw} onChange={setNewPw} disabled={!unlocked} autoComplete="off" hint="At least 4 characters" />
            <TextField label="Confirm new password" type="password" value={confirmPw} onChange={setConfirmPw} disabled={!unlocked} autoComplete="off" />
          </div>
          <div className="flex items-center gap-3"><Button type="submit" variant="primary" disabled={!unlocked || !oldPw || !newPw}>Change password</Button>{!unlocked && <span className="text-[13px] text-muted">Unlock above first.</span>}</div>
        </form>
      </Panel>
      <p className="mt-4 text-xs text-muted">This prototype checks passwords in the browser, which is not secure. Real sign-in with protected passwords comes in a later stage.</p>
    </div>
  );
}
