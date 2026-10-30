import { useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Trash2 } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Checkbox, ErrorList, TextField } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { AccessionPicker } from '../../components/ui/AccessionPicker';
import { NoteField, emptyNote, noteText, type NoteValue } from '../../components/ui/NoteField';
import { toast } from '../../components/ui/toast';
import { bookById, borrowerName, borrowerSub, openLoansOf } from '../../domain/queries';
import { addDays, duesFor, formatDate, LIBRARIES, lateDays, rupees, todayISO } from '../../domain/rules';
import type { Borrower, LostOutcome } from '../../domain/types';
import { isCrossLibrary, issueBlock, lateFineFor, processTransaction, undoLast } from '../../store/actions';
import { getUndo, useStore } from '../../store/store';
import { cn } from '../../lib/cn';
import { OneAtATime } from './OneAtATime';

export interface PanelProps {
  open: boolean;
  onClose: () => void;
  borrower: Borrower;
  preselectReturn?: string[];
  issueParkedText?: string;
  resolvePendingIds?: string[];
}

interface FineDec { waive: string; note: NoteValue; settle: 'collected' | 'owed' }
interface LostDec { on: boolean; outcome: LostOutcome; note: string }

export function SeveralAtOnce({ open, onClose, borrower, preselectReturn = [], issueParkedText, resolvePendingIds = [], onSwitchMode }: PanelProps & { onSwitchMode: () => void }) {
  const state = useStore((s) => s);
  const today = todayISO();
  const dues = duesFor(state, borrower);
  const loans = useMemo(() => openLoansOf(state, borrower), [state, borrower]);

  const [retSel, setRetSel] = useState<string[]>(preselectReturn);
  const [retParked, setRetParked] = useState(false);
  const [lost, setLost] = useState<Record<string, LostDec>>({});
  const [fineDec, setFineDec] = useState<Record<string, FineDec>>({});
  const [issueIds, setIssueIds] = useState<string[]>([]);
  const [issueParked, setIssueParked] = useState(!!issueParkedText);
  const [parkedText, setParkedText] = useState(issueParkedText ?? '');
  const [cross, setCross] = useState<NoteValue>(emptyNote());
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const loanBooks = loans.map((l) => bookById(state, l.bookId)!).filter(Boolean);
  const issueBooks = issueIds.map((id) => bookById(state, id)!).filter(Boolean);
  const crossBooks = issueBooks.filter((b) => isCrossLibrary(state, borrower, b));

  const toggleReturn = (id: string, on: boolean) => setRetSel((s) => (on ? [...new Set([...s, id])] : s.filter((x) => x !== id)));
  const decOf = (id: string): FineDec => fineDec[id] ?? { waive: '', note: emptyNote(), settle: 'collected' };
  const lostOf = (id: string): LostDec => lost[id] ?? { on: false, outcome: 'Paid', note: '' };

  // live fine figures for books being returned now
  const figures = loans.filter((l) => retSel.includes(l.id) && !lostOf(l.id).on).map((l) => {
    const { late, amount } = lateFineFor(state, borrower, l);
    const waive = Math.min(Math.max(Number(decOf(l.id).waive) || 0, 0), amount);
    return { loan: l, late, amount, waive, payable: amount - waive, settle: decOf(l.id).settle };
  });
  const payNow = retParked ? 0 : figures.filter((f) => f.settle === 'collected').reduce((n, f) => n + f.payable, 0);
  const owedLater = retParked ? 0 : figures.filter((f) => f.settle === 'owed').reduce((n, f) => n + f.payable, 0);
  const waivedTotal = retParked ? 0 : figures.reduce((n, f) => n + f.waive, 0);
  const lostCount = retParked ? 0 : loans.filter((l) => retSel.includes(l.id) && lostOf(l.id).on).length;

  const confirm = () => {
    setBusy(true);
    const result = processTransaction({
      borrower,
      returns: {
        loanIds: retSel,
        parked: retParked,
        lost: Object.fromEntries(loans.filter((l) => retSel.includes(l.id) && lostOf(l.id).on).map((l) => [l.id, { outcome: lostOf(l.id).outcome, note: lostOf(l.id).note }])),
        fines: Object.fromEntries(figures.map((f) => [f.loan.id, { waive: f.waive, note: noteText(decOf(f.loan.id).note), settle: f.settle }])),
      },
      issue: { bookIds: issueIds, parked: issueParked, parkedText, crossNote: noteText(cross) },
      resolvePendingIds,
    });
    setBusy(false);
    if (!result.ok) return setErrors(result.errors);
    const snap = getUndo();
    toast(result.message ?? 'Done.', { action: snap ? { label: 'Undo', run: () => { undoLast(snap); toast('Last transaction undone.'); } } : undefined });
    onClose();
  };

  const nothing = !retSel.length && !issueIds.length && !issueParked;
  const heldAfter = loans.length - (retParked ? 0 : retSel.length) + (issueParked ? 0 : issueIds.length);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Issue / Return"
      description={`${borrowerName(state, borrower)} · ${borrowerSub(state, borrower)}`}
      footer={
        <>
          <p className="mr-auto text-[13px] text-muted">
            {retSel.length > 0 && <>{retParked ? `${retSel.length} to Pending` : `${retSel.length - lostCount} return${retSel.length - lostCount === 1 ? '' : 's'}${lostCount ? `, ${lostCount} lost` : ''}`}</>}
            {retSel.length > 0 && (issueIds.length > 0 || issueParked) && ' · '}
            {issueParked ? '1 issue to Pending' : issueIds.length > 0 && `${issueIds.length} issue${issueIds.length === 1 ? '' : 's'}`}
            {payNow > 0 && ` · fine ${rupees(payNow)} now`}{owedLater > 0 && ` · ${rupees(owedLater)} owed`}{waivedTotal > 0 && ` · ${rupees(waivedTotal)} waived`}
            {nothing && 'Nothing selected yet.'}
          </p>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={confirm} loading={busy} disabled={nothing}>Confirm</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-control bg-canvas px-3 py-2 text-[13px] text-muted">
          <span>Several at once: build a list, then confirm everything together.</span>
          <button type="button" onClick={onSwitchMode} className="font-medium text-accent underline underline-offset-2">One book at a time</button>
        </div>
        <ErrorList errors={errors} />

        {/* RETURN */}
        <section aria-labelledby="return-heading" className="rounded-panel border border-line">
          <header className="flex items-center gap-2 border-b border-line bg-canvas px-4 py-2.5">
            <ArrowDownToLine className="size-4 text-accent" aria-hidden />
            <h3 id="return-heading" className="text-sm font-semibold">Return</h3>
            <span className="ml-auto text-xs text-muted">{loans.length} with {borrower.type === 'student' ? 'student' : 'teacher'}</span>
          </header>
          <div className="space-y-3 p-4">
            {loans.length === 0 ? (
              <p className="text-sm text-muted">No books to return. Nothing is currently issued.</p>
            ) : (
              <ul className="divide-y divide-line rounded-control border border-line">
                {loans.map((l) => {
                  const b = bookById(state, l.bookId)!;
                  const late = lateDays(l.dueOn, today);
                  const checked = retSel.includes(l.id);
                  const f = figures.find((x) => x.loan.id === l.id);
                  const ld = lostOf(l.id);
                  return (
                    <li key={l.id} className={cn('p-3', checked && 'bg-sage-soft')}>
                      <label className="flex cursor-pointer items-start gap-3">
                        <input type="checkbox" checked={checked} onChange={(e) => toggleReturn(l.id, e.target.checked)} className="mt-1 size-4 accent-[var(--color-primary)]" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-ink">{b.title}</span>
                          <span className="block text-xs text-muted">#{b.accession} · issued {formatDate(l.issuedOn, { day: 'numeric', month: 'short' })} · due {formatDate(l.dueOn, { day: 'numeric', month: 'short' })}</span>
                        </span>
                        {late > 0 ? <Badge tone="amber">{late} day{late > 1 ? 's' : ''} late · {rupees(lateFineFor(state, borrower, l).amount)}</Badge> : <Badge tone="sage">On time</Badge>}
                      </label>
                      {checked && !retParked && (
                        <div className="mt-3 ml-7 space-y-3 border-l-2 border-line pl-4">
                          <Checkbox checked={ld.on} onChange={(v) => setLost({ ...lost, [l.id]: { ...ld, on: v } })} label="Book is lost" />
                          {ld.on ? (
                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="block text-[13px] font-medium">Outcome
                                <select value={ld.outcome} onChange={(e) => setLost({ ...lost, [l.id]: { ...ld, outcome: e.target.value as LostOutcome } })} className="mt-1.5 h-10 w-full rounded-control border border-line bg-panel px-3 text-sm font-normal">
                                  {(['Paid', 'Replaced', 'Not paid'] as LostOutcome[]).map((o) => <option key={o}>{o}</option>)}
                                </select>
                              </label>
                              <TextField label="Note (required)" value={ld.note} onChange={(v) => setLost({ ...lost, [l.id]: { ...ld, note: v } })} placeholder="e.g. replaced with same title" />
                            </div>
                          ) : f && f.amount > 0 ? (
                            <div className="space-y-3">
                              <p className="text-sm">Fine: <span className="font-semibold">{rupees(f.amount)}</span> <span className="text-muted">({f.late} days × {rupees(dues.finePerDay)})</span></p>
                              <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
                                <TextField label="Waive (₹)" type="number" min={0} max={f.amount} inputMode="numeric" value={decOf(l.id).waive} onChange={(v) => setFineDec({ ...fineDec, [l.id]: { ...decOf(l.id), waive: v } })} hint={`0 to ${f.amount}`} />
                                {f.waive > 0 && <NoteField category="fineWaiver" required label="Reason for waiving" value={decOf(l.id).note} onChange={(v) => setFineDec({ ...fineDec, [l.id]: { ...decOf(l.id), note: v } })} />}
                              </div>
                              {f.payable > 0 && (
                                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`Payment of ${rupees(f.payable)}`}>
                                  {([['collected', `Collected now (${rupees(f.payable)})`], ['owed', `Owed, pay later (${rupees(f.payable)})`]] as const).map(([v, label]) => (
                                    <label key={v} className={cn('flex cursor-pointer items-center gap-2 rounded-control border px-3 py-1.5 text-[13px]', decOf(l.id).settle === v ? 'border-primary bg-panel' : 'border-line')}>
                                      <input type="radio" checked={decOf(l.id).settle === v} onChange={() => setFineDec({ ...fineDec, [l.id]: { ...decOf(l.id), settle: v } })} className="accent-[var(--color-primary)]" />{label}
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {loans.length > 0 && (
              <AccessionPicker
                label="return-book"
                pool={loanBooks}
                selected={loans.filter((l) => retSel.includes(l.id)).map((l) => l.bookId)}
                onAdd={(b) => { const l = loans.find((x) => x.bookId === b.id); if (l) toggleReturn(l.id, true); }}
                placeholder="Scan or type the accession number of a returned book"
                emptyHint="That book is not issued to this borrower."
              />
            )}
            <Checkbox checked={retParked} onChange={setRetParked} label="Not submitted / will update" description="The ticked books were not handed in. They stay with the borrower and appear in Pending." />
          </div>
        </section>

        {/* ISSUE */}
        <section aria-labelledby="issue-heading" className="rounded-panel border border-line">
          <header className="flex items-center gap-2 border-b border-line bg-canvas px-4 py-2.5">
            <ArrowUpFromLine className="size-4 text-accent" aria-hidden />
            <h3 id="issue-heading" className="text-sm font-semibold">Issue</h3>
            <span className="ml-auto text-xs text-muted">Limit {dues.maxBooks} · {dues.loanDays} days · {rupees(dues.finePerDay)}/day late · holding {heldAfter}</span>
          </header>
          <div className="space-y-3 p-4">
            {issueParked ? (
              <label className="block text-[13px] font-medium text-ink">What was taken? (optional)
                <textarea value={parkedText} onChange={(e) => setParkedText(e.target.value)} rows={2} placeholder="e.g. a mystery novel, title to be entered later" className="mt-1.5 w-full rounded-control border border-line bg-panel px-3 py-2 text-sm font-normal placeholder:text-muted" />
              </label>
            ) : (
              <>
                <AccessionPicker
                  label="issue-book"
                  pool={state.books}
                  selected={issueIds}
                  onAdd={(b) => setIssueIds((ids) => [...ids, b.id])}
                  blockReason={(b) => issueBlock(state, borrower, b)}
                  placeholder="Scan or type an accession number or title"
                />
                {issueBooks.length > 0 && (
                  <ul className="divide-y divide-line rounded-control border border-line">
                    {issueBooks.map((b) => (
                      <li key={b.id} className="flex items-center gap-3 px-3 py-2.5">
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-ink">{b.title}</span>
                          <span className="block text-xs text-muted">#{b.accession} · {LIBRARIES[b.library].label} · due {formatDate(addDays(today, dues.loanDays), { day: 'numeric', month: 'short' })}</span>
                        </span>
                        {isCrossLibrary(state, borrower, b) && <Badge tone="amber">Cross-library</Badge>}
                        <button type="button" aria-label={`Remove ${b.title}`} onClick={() => setIssueIds((ids) => ids.filter((x) => x !== b.id))} className="grid size-8 place-items-center rounded-control text-muted hover:bg-sage-soft hover:text-ink"><Trash2 className="size-4" aria-hidden /></button>
                      </li>
                    ))}
                  </ul>
                )}
                {crossBooks.length > 0 && <NoteField category="crossLibrary" required label="Cross-library note" value={cross} onChange={setCross} />}
              </>
            )}
            <Checkbox checked={issueParked} onChange={setIssueParked} label="Not submitted / will update" description="Take note now and enter the book details later. No book is issued yet and it appears in Pending." />
          </div>
        </section>
        {resolvePendingIds.length > 0 && <p className="text-[13px] text-muted">Confirming will clear the pending item this was opened from.</p>}
      </div>
    </Modal>
  );
}

/** Opens in the mode chosen in Settings. One book at a time is the quick default. */
export function IssueReturnPanel(props: PanelProps) {
  const initial = useStore((s) => s.prefs.issueMode);
  const [mode, setMode] = useState(initial);
  return mode === 'one'
    ? <OneAtATime {...props} onSwitchMode={() => setMode('several')} />
    : <SeveralAtOnce {...props} onSwitchMode={() => setMode('one')} />;
}
