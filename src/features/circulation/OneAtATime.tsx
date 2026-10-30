import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownToLine, ArrowUpFromLine, CircleCheck, TriangleAlert } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { AccessionPicker } from '../../components/ui/AccessionPicker';
import { ErrorList, TextField } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { NoteField, emptyNote, noteText, type NoteValue } from '../../components/ui/NoteField';
import { toast } from '../../components/ui/toast';
import { bookById, borrowerName, borrowerPath, borrowerSub, fineOwed, openLoansOf, borrowerOf } from '../../domain/queries';
import { addDays, diffDays, duesFor, formatDate, LIBRARIES, lateDays, rupees, todayISO } from '../../domain/rules';
import type { Book, LostOutcome } from '../../domain/types';
import { cn } from '../../lib/cn';
import { isCrossLibrary, issueBlock, lateFineFor, processTransaction, undoLast } from '../../store/actions';
import { getUndo, useStore } from '../../store/store';
import type { PanelProps } from './IssueReturnPanel';

type Active = { kind: 'return'; loanId: string } | { kind: 'issue'; bookId: string };
interface DoneItem { id: number; text: string; tone: 'ok' | 'pending' }

export function OneAtATime({ open, onClose, borrower, preselectReturn = [], issueParkedText, resolvePendingIds = [], onSwitchMode }: PanelProps & { onSwitchMode: () => void }) {
  const state = useStore((s) => s);
  const prefs = state.prefs;
  const today = todayISO();
  const dues = duesFor(state, borrower);
  const loans = useMemo(() => openLoansOf(state, borrower), [state, borrower]);

  const [queue, setQueue] = useState<string[]>(preselectReturn);
  const [active, setActive] = useState<Active | null>(preselectReturn[0] ? { kind: 'return', loanId: preselectReturn[0] } : null);
  const [waiveOn, setWaiveOn] = useState(false);
  const [waive, setWaive] = useState('');
  const [waiveNote, setWaiveNote] = useState<NoteValue>(emptyNote());
  const [settle, setSettle] = useState<'collected' | 'owed'>('collected');
  const [lostOn, setLostOn] = useState(false);
  const [lostOutcome, setLostOutcome] = useState<LostOutcome>('Paid');
  const [lostNote, setLostNote] = useState('');
  const [cross, setCross] = useState<NoteValue>(emptyNote());
  const [parkOpen, setParkOpen] = useState(!!issueParkedText);
  const [parkText, setParkText] = useState(issueParkedText ?? '');
  const [done, setDone] = useState<DoneItem[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [pickerKey, setPickerKey] = useState(0);
  const confirmRef = useRef<HTMLButtonElement>(null);

  // reset the card's own fields whenever a different book is chosen, and focus Confirm so Enter finishes it
  const activeKey = active ? (active.kind === 'return' ? `r-${active.loanId}` : `i-${active.bookId}`) : '';
  useEffect(() => {
    setWaiveOn(false); setWaive(''); setWaiveNote(emptyNote()); setSettle('collected'); setLostOn(false); setLostNote(''); setCross(emptyNote()); setErrors([]);
  }, [activeKey]);

  const finish = (text: string, tone: DoneItem['tone'], message?: string) => {
    setDone((d) => [{ id: Date.now() + d.length, text, tone }, ...d]);
    const snap = getUndo();
    toast(message ?? text, { action: snap ? { label: 'Undo', run: () => { undoLast(snap); toast('Last transaction undone.'); } } : undefined });
    const rest = queue.slice(1);
    const nextLoan = rest.find((id) => state.loans.find((l) => l.id === id && !l.returnedOn));
    setQueue(rest);
    setActive(nextLoan ? { kind: 'return', loanId: nextLoan } : null);
    setParkOpen(false); setParkText('');
    setPickerKey((k) => k + 1);
    if (!prefs.keepOpen && !nextLoan) onClose();
  };

  const run = (input: Parameters<typeof processTransaction>[0], text: string, tone: DoneItem['tone'] = 'ok') => {
    const r = processTransaction(input);
    if (!r.ok) return setErrors(r.errors);
    finish(text, tone, r.message);
  };
  const emptyReturns = { loanIds: [] as string[], parked: false, lost: {}, fines: {} };
  const emptyIssue = { bookIds: [] as string[], parked: false, parkedText: '', crossNote: '' };

  const onPick = (b: Book) => {
    const loan = loans.find((l) => l.bookId === b.id);
    setActive(loan ? { kind: 'return', loanId: loan.id } : { kind: 'issue', bookId: b.id });
  };

  // ---- return card ----
  const retLoan = active?.kind === 'return' ? state.loans.find((l) => l.id === active.loanId) : undefined;
  const retBook = retLoan ? bookById(state, retLoan.bookId) : undefined;
  const retLate = retLoan ? lateFineFor(state, borrower, retLoan) : { late: 0, amount: 0 };
  const waiveAmt = Math.min(Math.max(Math.floor(Number(waive) || 0), 0), retLate.amount);
  const payable = retLate.amount - waiveAmt;

  const confirmReturn = () => {
    if (!retLoan || !retBook) return;
    run({
      borrower,
      returns: {
        loanIds: [retLoan.id], parked: false,
        lost: lostOn ? { [retLoan.id]: { outcome: lostOutcome, note: lostNote } } : {},
        fines: retLate.amount > 0 && !lostOn ? { [retLoan.id]: { waive: waiveOn ? waiveAmt : 0, note: noteText(waiveNote), settle } } : {},
      },
      issue: emptyIssue, resolvePendingIds,
    }, lostOn ? `Marked “${retBook.title}” as lost` : `Returned “${retBook.title}”${retLate.amount > 0 ? `, fine ${rupees(waiveOn ? payable : retLate.amount)}${settle === 'owed' ? ' owed' : ''}` : ''}`);
  };
  const parkReturn = () => {
    if (!retLoan || !retBook) return;
    run({ borrower, returns: { ...emptyReturns, loanIds: [retLoan.id], parked: true }, issue: emptyIssue, resolvePendingIds: [] }, `“${retBook.title}” saved to Pending (not submitted)`, 'pending');
  };

  // ---- issue card ----
  const issBook = active?.kind === 'issue' ? bookById(state, active.bookId) : undefined;
  const holder = issBook?.status === 'Issued' ? state.loans.find((l) => !l.returnedOn && l.bookId === issBook.id) : undefined;
  const holderRef = holder ? { type: holder.borrowerType, id: holder.borrowerId } : null;
  const block = issBook ? issueBlock(state, borrower, issBook) : null;
  const isCross = issBook ? isCrossLibrary(state, borrower, issBook) : false;
  const overdueN = loans.filter((l) => lateDays(l.dueOn, today) > 0).length;
  const owedTotal = state.fines.filter((f) => f.borrowerType === borrower.type && f.borrowerId === borrower.id).reduce((n, f) => n + fineOwed(f), 0);
  const heldNow = loans.length;
  const atLimit = heldNow >= dues.maxBooks;
  const warn = prefs.warnOverdue && (overdueN > 0 || owedTotal > 0);
  const issueBlocked = !!block || atLimit || (prefs.blockOverdue && overdueN > 0) || (isCross && !noteText(cross));

  const confirmIssue = () => {
    if (!issBook) return;
    run({ borrower, returns: emptyReturns, issue: { ...emptyIssue, bookIds: [issBook.id], crossNote: noteText(cross) }, resolvePendingIds }, `Issued “${issBook.title}”, due ${formatDate(addDays(today, dues.loanDays), { day: 'numeric', month: 'short' })}`);
  };
  const parkIssue = (text: string) => {
    run({ borrower, returns: emptyReturns, issue: { ...emptyIssue, parked: true, parkedText: text }, resolvePendingIds: [] }, 'Issue saved to Pending (will update)', 'pending');
  };

  const person = borrowerOf(state, borrower);
  const cancel = () => { setActive(null); setPickerKey((k) => k + 1); };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Issue / Return"
      description={`${borrowerName(state, borrower)} · ${borrowerSub(state, borrower)}`}
      footer={<><span className="mr-auto text-[13px] text-muted">{done.length ? `${done.length} done in this visit` : 'Nothing done yet'}</span><Button variant={done.length ? 'primary' : 'secondary'} onClick={onClose}>{done.length ? 'Done' : 'Close'}</Button></>}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted">
          <span>Holding <span className="font-semibold text-ink">{heldNow}</span> of {dues.maxBooks} books · {dues.loanDays} days · {rupees(dues.finePerDay)} per late day</span>
          <button type="button" onClick={onSwitchMode} className="font-medium text-accent underline underline-offset-2">Several at once</button>
        </div>

        <div>
          <p className="mb-1.5 text-sm font-semibold">Scan or type the book</p>
          <AccessionPicker key={pickerKey} label="smart-book" pool={state.books} selected={[]} onAdd={onPick} autoFocus={!active}
            placeholder="Accession number or title. It is returned if they have it, otherwise issued."
            emptyHint="No book matches. Check the number, or add the book in Collections." />
        </div>

        {errors.length > 0 && <ErrorList errors={errors} />}

        {/* the one card for this book */}
        {active?.kind === 'return' && retLoan && retBook && (
          <section key={activeKey} aria-label="Return this book" className="rounded-panel border-2 border-primary/50 bg-sage-soft p-4">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.08em] text-accent uppercase"><ArrowDownToLine className="size-4" aria-hidden />Return</p>
            <p className="text-base font-semibold text-ink">{retBook.title}</p>
            <p className="text-[13px] text-muted">#{retBook.accession} · {LIBRARIES[retBook.library].label} · issued {formatDate(retLoan.issuedOn, { day: 'numeric', month: 'short' })} · due {formatDate(retLoan.dueOn, { day: 'numeric', month: 'short' })}</p>
            {retLate.late > 0 && !lostOn
              ? <p className="mt-2 text-sm"><Badge tone="amber">{retLate.late} day{retLate.late > 1 ? 's' : ''} late</Badge> <span className="ml-1">Fine <span className="font-semibold">{rupees(retLate.amount)}</span> <span className="text-muted">({retLate.late} × {rupees(dues.finePerDay)})</span></span></p>
              : !lostOn && <p className="mt-2 text-sm"><Badge tone="sage">On time</Badge> <span className="ml-1 text-muted">No fine.</span></p>}

            {lostOn ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-[13px] font-medium">What happened?
                  <select value={lostOutcome} onChange={(e) => setLostOutcome(e.target.value as LostOutcome)} className="mt-1.5 h-10 w-full rounded-control border border-line bg-panel px-3 text-sm font-normal">{(['Paid', 'Replaced', 'Not paid'] as LostOutcome[]).map((o) => <option key={o}>{o}</option>)}</select>
                </label>
                <TextField label="Note (required)" value={lostNote} onChange={setLostNote} placeholder="e.g. replaced with same title" />
              </div>
            ) : retLate.amount > 0 && (
              <div className="mt-3 space-y-3">
                {!waiveOn ? (
                  <button type="button" onClick={() => setWaiveOn(true)} className="text-[13px] font-medium text-accent underline underline-offset-2">Waive some or all of the fine</button>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
                    <TextField label="Waive (₹)" type="number" min={0} max={retLate.amount} inputMode="numeric" value={waive} onChange={setWaive} hint={`0 to ${retLate.amount}`} autoFocus />
                    {waiveAmt > 0 && <NoteField category="fineWaiver" required label="Why?" value={waiveNote} onChange={setWaiveNote} />}
                  </div>
                )}
                {payable > 0 && (
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Fine payment">
                    {([['collected', `Collected now ${rupees(payable)}`], ['owed', `Pay later ${rupees(payable)}`]] as const).map(([v, label]) => (
                      <label key={v} className={cn('flex cursor-pointer items-center gap-2 rounded-control border px-3 py-1.5 text-[13px]', settle === v ? 'border-primary bg-panel' : 'border-line')}>
                        <input type="radio" checked={settle === v} onChange={() => setSettle(v)} className="accent-[var(--color-primary)]" />{label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button variant="primary" onClick={confirmReturn} ref={confirmRef} autoFocus disabled={lostOn && !lostNote.trim()}>{lostOn ? 'Confirm lost' : 'Confirm return'}</Button>
              <Button onClick={parkReturn} disabled={lostOn}>Not submitted</Button>
              <Button variant="ghost" onClick={() => setLostOn((v) => !v)}>{lostOn ? 'Not lost' : 'Book is lost'}</Button>
              <Button variant="ghost" onClick={cancel}>Cancel</Button>
            </div>
          </section>
        )}

        {active?.kind === 'issue' && issBook && (
          <section key={activeKey} aria-label="Issue this book" className="rounded-panel border-2 border-primary/50 bg-sage-soft p-4">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.08em] text-accent uppercase"><ArrowUpFromLine className="size-4" aria-hidden />Issue</p>
            <p className="text-base font-semibold text-ink">{issBook.title}</p>
            <p className="text-[13px] text-muted">#{issBook.accession} · {issBook.author ?? 'Author not recorded'} · {LIBRARIES[issBook.library].label}{issBook.type.toUpperCase() === 'DF' ? ' · Daily Five' : ''}</p>

            {block ? (
              <div className="mt-3 rounded-control border border-amber/50 bg-amber-soft p-3 text-sm">
                <p className="flex items-start gap-2 font-medium"><TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber" aria-hidden />{block}.</p>
                {holderRef && <p className="mt-1 text-[13px] text-muted">It is with {borrowerName(state, holderRef)} ({borrowerSub(state, holderRef)}), since {formatDate(holder!.issuedOn, { day: 'numeric', month: 'short' })}. <Link to={`${borrowerPath(holderRef)}?panel=1&ret=${holder!.id}`} className="font-medium text-accent underline">Return it from {borrowerName(state, holderRef).split(' ')[0]}</Link></p>}
              </div>
            ) : (
              <p className="mt-2 text-sm">Due <span className="font-semibold">{formatDate(addDays(today, dues.loanDays), { weekday: 'short', day: 'numeric', month: 'short' })}</span> <span className="text-muted">({dues.loanDays} days)</span></p>
            )}
            {!block && atLimit && <p className="mt-2 rounded-control border border-amber/50 bg-amber-soft p-3 text-[13px]">{person?.name.split(' ')[0]} already has {heldNow} books, the limit. Return one first.</p>}
            {!block && warn && <p className="mt-2 flex items-start gap-2 rounded-control border border-amber/50 bg-amber-soft p-3 text-[13px]"><TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber" aria-hidden />{[overdueN > 0 && `${overdueN} overdue book${overdueN > 1 ? 's' : ''}`, owedTotal > 0 && `${rupees(owedTotal)} fine unpaid`].filter(Boolean).join(' and ')}.{prefs.blockOverdue && overdueN > 0 ? ' Issuing is turned off until it is returned.' : ''}</p>}
            {!block && isCross && <div className="mt-3"><p className="mb-2 text-[13px]"><Badge tone="amber">Cross-library</Badge> <span className="ml-1 text-muted">This book is from the {LIBRARIES[issBook.library].label}.</span></p><NoteField category="crossLibrary" required label="Cross-library note" value={cross} onChange={setCross} /></div>}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button variant="primary" ref={confirmRef} autoFocus onClick={confirmIssue} disabled={issueBlocked}>Confirm issue</Button>
              <Button onClick={() => parkIssue(`Took “${issBook.title}”`)}>Will update later</Button>
              <Button variant="ghost" onClick={cancel}>Cancel</Button>
            </div>
          </section>
        )}

        {!active && (
          <p className="rounded-control border border-dashed border-line px-4 py-4 text-center text-sm text-muted">
            Scan a book, or tap <span className="font-medium text-ink">Return</span> next to a book they have.
          </p>
        )}

        {loans.length > 0 && (
          <div>
            <p className="mb-1.5 text-sm font-semibold">Books they have now</p>
            <ul className="divide-y divide-line rounded-control border border-line">
              {loans.map((l) => {
                const b = bookById(state, l.bookId)!;
                const late = lateDays(l.dueOn, today);
                const left = diffDays(l.dueOn, today);
                const isActive = active?.kind === 'return' && active.loanId === l.id;
                return (
                  <li key={l.id} className={cn('flex flex-wrap items-center gap-3 px-3 py-2.5', isActive && 'bg-sage-soft')}>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{b.title}</span><span className="text-xs text-muted">#{b.accession} · due {formatDate(l.dueOn, { day: 'numeric', month: 'short' })}</span></span>
                    {late > 0 ? <Badge tone="amber">{late}d late · {rupees(late * dues.finePerDay)}</Badge> : <Badge tone="sage">{left === 0 ? 'Due today' : `${left}d left`}</Badge>}
                    <Button size="sm" variant={isActive ? 'primary' : 'secondary'} onClick={() => setActive({ kind: 'return', loanId: l.id })} aria-label={`Return ${b.title}`}>Return</Button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div>
          {!parkOpen ? (
            <button type="button" onClick={() => setParkOpen(true)} className="text-[13px] font-medium text-accent underline underline-offset-2">Took a book that isn’t entered yet? Save it to Pending</button>
          ) : (
            <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); parkIssue(parkText.trim() || 'Book to be entered'); }}>
              <TextField className="min-w-60 flex-1" label="What was taken? (optional)" value={parkText} onChange={setParkText} placeholder="e.g. a mystery novel, title to be entered later" autoFocus />
              <Button type="submit" variant="secondary">Save to Pending</Button>
              <Button onClick={() => setParkOpen(false)} variant="ghost">Cancel</Button>
            </form>
          )}
        </div>

        {done.length > 0 && (
          <div>
            <p className="mb-1.5 text-sm font-semibold">Done in this visit</p>
            <ul className="space-y-1" aria-live="polite">
              {done.map((d) => <li key={d.id} className="flex items-start gap-2 text-[13px]"><CircleCheck className={cn('mt-0.5 size-4 shrink-0', d.tone === 'ok' ? 'text-accent' : 'text-amber')} aria-hidden />{d.text}</li>)}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
