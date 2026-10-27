import { useState } from 'react';
import { Lock } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { TextField } from '../../components/ui/Field';
import { LIBRARIES } from '../../domain/rules';
import type { LibraryId } from '../../domain/types';
import { checkPassword } from '../../store/actions';

/** Asks for a library's password. Used before switching library. */
export function LibraryGate({ library, open, onClose, onUnlocked }: { library: LibraryId; open: boolean; onClose: () => void; onUnlocked: () => void }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [tries, setTries] = useState(0);

  const close = () => { setPw(''); setError(''); setTries(0); onClose(); };
  const submit = () => {
    if (tries >= 5) return setError('Too many attempts. Wait a moment and try again.');
    if (checkPassword(library, pw)) { setPw(''); setError(''); setTries(0); onUnlocked(); }
    else {
      const t = tries + 1;
      setTries(t);
      setError(t >= 5 ? 'Too many attempts. Wait a moment and try again.' : 'That password is not correct.');
      if (t >= 5) window.setTimeout(() => setTries(0), 15_000);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={`Switch to ${LIBRARIES[library].label}`}
      description="Enter this library’s password to continue."
      footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" icon={<Lock className="size-4" aria-hidden />} onClick={submit}>Unlock</Button></>}
    >
      <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <TextField label="Password" type="password" autoFocus value={pw} onChange={(v) => { setPw(v); setError(''); }} error={error} hint="Demo passwords: jr123 and sr123" autoComplete="off" />
      </form>
    </Modal>
  );
}
