import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { ErrorList, TextField } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { NoteField, emptyNote, noteText } from '../../components/ui/NoteField';
import { notify } from '../../components/ui/toast';
import { bookById, borrowerName, fineOwed } from '../../domain/queries';
import { rupees } from '../../domain/rules';
import type { Fine } from '../../domain/types';
import { cn } from '../../lib/cn';
import { waiveFine } from '../../store/actions';
import { useStore } from '../../store/store';

type Choice = 'all' | 'half' | 'custom';

/** Waive all, half or part of a fine, then say why. The reason is kept with the fine and shown in Reports. */
export function WaiveDialog({ fine, onClose }: { fine: Fine | null; onClose: () => void }) {
  const state = useStore((s) => s);
  const owed = fine ? fineOwed(fine) : 0;
  const [choice, setChoice] = useState<Choice>('all');
  const [custom, setCustom] = useState('');
  const [note, setNote] = useState(emptyNote());
  const [errors, setErrors] = useState<string[]>([]);

  const half = Math.floor(owed / 2);
  const amount = choice === 'all' ? owed : choice === 'half' ? half : Math.floor(Number(custom) || 0);
  const options: Array<{ id: Choice; title: string; sub: string }> = [
    { id: 'all', title: 'The whole fine', sub: rupees(owed) },
    ...(half >= 1 ? [{ id: 'half' as const, title: 'Half', sub: rupees(half) }] : []),
    { id: 'custom', title: 'A different amount', sub: 'You choose' },
  ];

  const save = () => {
    if (!fine) return;
    const res = waiveFine(fine.id, amount, noteText(note));
    if (!res.ok) return setErrors(res.errors);
    notify(res);
    onClose();
  };
  const who = fine ? borrowerName(state, { type: fine.borrowerType, id: fine.borrowerId }) : '';
  return (
    <Modal open={!!fine} onClose={onClose} title="Waive a fine" description={fine ? `${who} · ${bookById(state, fine.bookId)?.title ?? ''}` : undefined}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save} disabled={amount < 1 || amount > owed}>{amount > 0 ? `Waive ${rupees(amount)}` : 'Waive'}</Button></>}>
      <div className="space-y-5">
        <ErrorList errors={errors} />
        <p className="text-sm">This fine has <span className="font-semibold">{rupees(owed)}</span> left to collect.</p>
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium">How much do you want to waive?</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {options.map((o) => (
              <label key={o.id} className={cn('cursor-pointer rounded-control border p-3 text-sm', choice === o.id ? 'border-primary bg-sage-soft' : 'border-line hover:bg-sage-soft/50')}>
                <span className="flex items-center gap-2 font-medium"><input type="radio" name="waive" checked={choice === o.id} onChange={() => setChoice(o.id)} className="accent-[var(--color-primary)]" />{o.title}</span>
                <span className="mt-0.5 block pl-6 text-xs text-muted">{o.sub}</span>
              </label>
            ))}
          </div>
          {choice === 'custom' && <TextField className="mt-3 max-w-48" label="Amount (₹)" type="number" min={1} max={owed} inputMode="numeric" value={custom} onChange={setCustom} hint={`1 to ${owed}`} autoFocus />}
        </fieldset>
        <NoteField category="fineWaiver" required label="Why is it being waived?" value={note} onChange={setNote} />
        <p className="rounded-control bg-canvas px-3 py-2 text-[13px] text-muted">
          {amount > 0 && amount <= owed ? <>After this, <span className="font-medium text-ink">{rupees(owed - amount)}</span> is still to collect. The waiver and your reason are recorded.</> : 'Choose an amount to see what is left.'}
        </p>
      </div>
    </Modal>
  );
}
