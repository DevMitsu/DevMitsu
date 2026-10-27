import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { ErrorList, TextField } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { NoteField, emptyNote, noteText } from '../../components/ui/NoteField';
import { notify } from '../../components/ui/toast';
import { fineOwed } from '../../domain/queries';
import { rupees } from '../../domain/rules';
import type { Fine } from '../../domain/types';
import { waiveFine } from '../../store/actions';

/** Waive all or part of an owed fine. A note is required and is kept with the fine. */
export function WaiveDialog({ fine, onClose }: { fine: Fine | null; onClose: () => void }) {
  const owed = fine ? fineOwed(fine) : 0;
  const [amount, setAmount] = useState(String(owed));
  const [note, setNote] = useState(emptyNote());
  const [errors, setErrors] = useState<string[]>([]);
  const save = () => {
    if (!fine) return;
    const res = waiveFine(fine.id, Number(amount), noteText(note));
    if (!res.ok) return setErrors(res.errors);
    notify(res);
    onClose();
  };
  return (
    <Modal open={!!fine} onClose={onClose} title="Waive fine" description={fine ? `${rupees(owed)} is owed. Enter all or part of it.` : undefined}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Waive</Button></>}>
      <div className="space-y-4">
        <ErrorList errors={errors} />
        <TextField label="Amount to waive (₹)" type="number" min={1} max={owed} inputMode="numeric" value={amount} onChange={setAmount} hint={`Up to ${rupees(owed)}`} autoFocus />
        <NoteField category="fineWaiver" required label="Reason" value={note} onChange={setNote} />
        <p className="text-xs text-muted">Waivers are recorded with the reason and appear in Reports.</p>
      </div>
    </Modal>
  );
}
