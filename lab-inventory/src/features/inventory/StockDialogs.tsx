import { useState } from 'react';
import { Button, Checkbox, Field, Modal, Suggest } from '../../components/ui';
import { attempt, notify, tryDo } from '../../components/toast';
import { todayStr } from '../../domain/dates';
import { num } from '../../domain/fields';
import { suggestedFine } from '../../domain/fines';
import { outOnLoan } from '../../domain/inventory';
import { closeUi } from '../../lib/ui';
import { adjustStock, receiveRequirement, receiveStock, returnLoan, saveRecord, transferStock } from '../../store/actions';
import { useStore } from '../../store/store';

const numOrUndef = (v: string) => (v.trim() === '' || !Number.isFinite(Number(v)) ? undefined : Number(v));

export function ReceiveDialog({ itemId }: { itemId: string }) {
  const item = useStore((s) => s.items.find((i) => i.id === itemId));
  const cat = useStore((s) => s.categories.find((c) => c.id === item?.categoryId));
  const suppliers = useStore((s) => s.suppliers);
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [lot, setLot] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cost, setCost] = useState('');
  const [supplier, setSupplier] = useState(item?.supplier ?? '');
  if (!item) return null;
  const close = () => closeUi('receive');
  const q = numOrUndef(qty);
  return (
    <Modal
      size="sm"
      title={`Receive stock: ${item.name}`}
      sub={`Currently ${item.quantity} ${item.unit}`}
      onClose={close}
      footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" disabled={!q || q <= 0} onClick={() => tryDo(() => receiveStock(item.id, { qty: q!, note, lot: lot || undefined, expiry: expiry || undefined, unitCost: numOrUndef(cost), supplier: supplier || undefined }), `Added ${q} ${item.unit}`) && close()}>Add to stock</Button></>}
    >
      <div className="grid gap-3">
        <Field label={`Quantity received (${item.unit})`} required><input className="input" type="number" min="0" step="any" autoFocus value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
        {cat?.trackExpiry && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="New expiry date" help="Replaces the item's date"><input className="input" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} /></Field>
            <Field label="Lot / batch"><input className="input" value={lot} onChange={(e) => setLot(e.target.value)} /></Field>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Cost per ${item.unit}`}><input className="input" type="number" min="0" step="any" value={cost} onChange={(e) => setCost(e.target.value)} placeholder={item.unitCost != null ? String(item.unitCost) : ''} /></Field>
          <Field label="Supplier"><Suggest value={supplier} onChange={setSupplier} options={suppliers.map((s) => s.name)} /></Field>
        </div>
        <Field label="Note"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Invoice number, donated by..." /></Field>
      </div>
    </Modal>
  );
}

export function AdjustDialog({ itemId }: { itemId: string }) {
  const item = useStore((s) => s.items.find((i) => i.id === itemId));
  const [qty, setQty] = useState(String(item?.quantity ?? ''));
  const [note, setNote] = useState('');
  if (!item) return null;
  const close = () => closeUi('adjust');
  const q = numOrUndef(qty);
  const diff = q != null ? Math.round((q - item.quantity) * 1e6) / 1e6 : 0;
  return (
    <Modal
      size="sm"
      title={`Correct the count: ${item.name}`}
      sub="Use this after counting what is really on the shelf."
      onClose={close}
      footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" disabled={q == null || q < 0 || diff === 0 || !note.trim()} onClick={() => tryDo(() => adjustStock(item.id, q!, note.trim()), 'Stock corrected') && close()}>Save count</Button></>}
    >
      <div className="grid gap-3">
        <Field label={`Quantity actually in stock (${item.unit})`} required help={diff !== 0 ? `${diff > 0 ? '+' : ''}${diff} ${item.unit} compared with the system (${item.quantity})` : `System says ${item.quantity} ${item.unit}`}>
          <input className="input" type="number" min="0" step="any" autoFocus value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        <Field label="Reason" required help="Kept in the stock history"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Recount after stocktake, found in another cupboard" /></Field>
      </div>
    </Modal>
  );
}

export function TransferDialog({ itemId }: { itemId: string }) {
  const item = useStore((s) => s.items.find((i) => i.id === itemId));
  const labs = useStore((s) => s.labs).filter((l) => !l.archived && l.id !== item?.labId);
  const records = useStore((s) => s.records);
  const [to, setTo] = useState(labs[0]?.id ?? '');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  if (!item) return null;
  const close = () => closeUi('transfer');
  const free = Math.round((item.quantity - (outOnLoan(records).get(item.id) ?? 0)) * 1e6) / 1e6;
  const q = numOrUndef(qty);
  return (
    <Modal
      size="sm"
      title={`Transfer: ${item.name}`}
      sub={`${free} ${item.unit} can be moved`}
      onClose={close}
      footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" disabled={!to || !q || q <= 0 || q > free} onClick={() => tryDo(() => transferStock(item.id, to, q!, note || undefined), 'Stock transferred') && close()}>Transfer</Button></>}
    >
      {labs.length === 0 ? <p className="text-sm text-muted">There is no other lab to transfer to.</p> : (
        <div className="grid gap-3">
          <Field label="Move to" required><select className="input" value={to} onChange={(e) => setTo(e.target.value)}>{labs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>
          <Field label={`Quantity (${item.unit})`} required><input className="input" type="number" min="0" step="any" autoFocus value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
          <Field label="Note"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <p className="help">If the other lab already has an item with this name and unit, the stock is added to it. Otherwise a new item is created there.</p>
        </div>
      )}
    </Modal>
  );
}

export function ReturnDialog({ recordId }: { recordId: string }) {
  const rec = useStore((s) => s.records.find((r) => r.id === recordId));
  const item = useStore((s) => s.items.find((i) => i.id === rec?.values.item));
  const conditions = useStore((s) => s.lists.find((l) => l.id === 'condition')?.options ?? []);
  const hasBreakage = useStore((s) => s.modules.some((m) => m.kind === 'breakage' && m.enabled));
  const [date, setDate] = useState(todayStr());
  const [condition, setCondition] = useState('Good');
  const [note, setNote] = useState('');
  const total = num(rec?.values.quantity) ?? 1;
  const [bad, setBad] = useState('1');
  const [log, setLog] = useState(true);
  const [fine, setFine] = useState('');
  const { currency, finePercent } = useStore((s) => s.settings);
  if (!rec) return null;
  const close = () => closeUi('ret');
  const damaged = condition === 'Damaged' || condition === 'Missing parts';
  const badN = numOrUndef(bad) ?? 0;
  const submit = () => {
    if (!tryDo(() => returnLoan(rec.id, date, condition, note || undefined))) return;
    if (damaged && log && hasBreakage && item && badN > 0) {
      attempt(() => saveRecord('breakage', rec.labId, { date, item: item.id, quantity: Math.min(badN, total), cause: 'Other', who: rec.values.borrower as string, class: rec.values.group as string | undefined, replace: true, fine: numOrUndef(fine), notes: `Found ${condition.toLowerCase()} on return` }));
    }
    notify('Marked as returned', 'ok', true);
    close();
  };
  return (
    <Modal
      size="sm"
      title="Receive equipment back"
      sub={`${total} × ${item?.name ?? 'item'} from ${String(rec.values.borrower ?? 'borrower')}`}
      onClose={close}
      footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" onClick={submit}>Mark returned</Button></>}
    >
      <div className="grid gap-3">
        <Field label="Returned on"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Condition"><select className="input" value={condition} onChange={(e) => setCondition(e.target.value)}>{conditions.map((c) => <option key={c}>{c}</option>)}</select></Field>
        {damaged && hasBreakage && total > 0 && (
          <div className="rounded-lg bg-surface2 p-3">
            <Checkbox checked={log} onChange={setLog}>Also log the damaged units as breakage (takes them off the stock)</Checkbox>
            {log && <Field label="How many units are damaged or missing?" className="mt-2"><input className="input" type="number" min="1" max={total} value={bad} onChange={(e) => setBad(e.target.value)} /></Field>}
            {log && (() => {
              const sug = suggestedFine(item, Math.min(badN, total), finePercent);
              return (
                <Field label={`Fine for ${String(rec.values.borrower ?? 'the borrower')} (optional)`} className="mt-2" help={sug !== undefined ? `Suggested ${currency}${sug}: ${finePercent}% of ${currency}${item?.unitCost} × ${Math.min(badN, total)}` : 'Leave empty for no fine'}>
                  <div className="flex gap-2"><input className="input" type="number" min="0" step="any" value={fine} onChange={(e) => setFine(e.target.value)} placeholder={sug !== undefined ? String(sug) : ''} />{sug !== undefined && <Button size="sm" onClick={() => setFine(String(sug))}>Use</Button>}</div>
                </Field>
              );
            })()}
          </div>
        )}
        <Field label="Note"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

export function ReceiveRequirementDialog({ recordId }: { recordId: string }) {
  const rec = useStore((s) => s.records.find((r) => r.id === recordId));
  const item = useStore((s) => s.items.find((i) => i.id === rec?.values.item));
  const [qty, setQty] = useState(String(rec?.values.quantity ?? ''));
  const [date, setDate] = useState(todayStr());
  const [add, setAdd] = useState(true);
  const [expiry, setExpiry] = useState('');
  const [lot, setLot] = useState('');
  const cat = useStoreCat(item?.categoryId);
  if (!rec) return null;
  const close = () => closeUi('receiveReq');
  const q = numOrUndef(qty);
  return (
    <Modal
      size="sm"
      title="Order received"
      sub={String(rec.values.name ?? '')}
      onClose={close}
      footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" disabled={add && item ? !q || q <= 0 : false} onClick={() => tryDo(() => receiveRequirement(rec.id, q ?? 0, date, add && !!item, { expiry: expiry || undefined, lot: lot || undefined }), 'Marked as received') && close()}>Confirm</Button></>}
    >
      <div className="grid gap-3">
        <Field label="Received on"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        {item ? (
          <>
            <Checkbox checked={add} onChange={setAdd}>Add it to the stock of <b>{item.name}</b></Checkbox>
            {add && (
              <>
                <Field label={`Quantity received (${item.unit})`}><input className="input" type="number" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
                {cat?.trackExpiry && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="New expiry date"><input className="input" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} /></Field>
                    <Field label="Lot / batch"><input className="input" value={lot} onChange={(e) => setLot(e.target.value)} /></Field>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">This requirement is not linked to an inventory item. After marking it received, add the new item under Inventory.</p>
        )}
      </div>
    </Modal>
  );
}

function useStoreCat(id?: string) {
  return useStore((s) => s.categories.find((c) => c.id === id));
}
