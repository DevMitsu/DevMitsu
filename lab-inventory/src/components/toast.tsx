import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { undo } from '../store/store';
import { Button, Modal } from './ui';

interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'error' | 'info';
  undoable?: boolean;
}

let toasts: Toast[] = [];
let n = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach((s) => s());

export function notify(text: string, tone: Toast['tone'] = 'ok', undoable = false) {
  const id = ++n;
  // Undo always reverses the latest change, so only the newest toast may offer it
  toasts = [...toasts.slice(-2).map((t) => ({ ...t, undoable: false })), { id, text, tone, undoable }];
  emit();
  setTimeout(() => dismiss(id), tone === 'error' ? 9000 : undoable ? 7000 : 3500);
}
function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

/**
 * Runs a change. Shows a friendly message if a rule stops it (not enough stock, duplicate code...)
 * and returns undefined. On success, shows a toast with Undo.
 */
export function attempt<T>(fn: () => T, ok?: string): T | undefined {
  try {
    const r = fn();
    if (ok) notify(ok, 'ok', true);
    return r;
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Something went wrong.', 'error');
    return undefined;
  }
}

/** Like attempt, for changes that return nothing: true when it worked. */
export function tryDo(fn: () => void, ok?: string): boolean {
  let done = false;
  attempt(() => {
    fn();
    done = true;
  }, ok);
  return done;
}

export function ToastHost() {
  const list = useSyncExternalStore((l) => { subs.add(l); return () => subs.delete(l); }, () => toasts);
  return (
    <div className="no-print pointer-events-none fixed right-4 bottom-4 left-4 z-[60] flex flex-col items-center gap-2 sm:left-auto sm:items-end" aria-live="polite">
      {list.map((t) => (
        <div
          key={t.id}
          role={t.tone === 'error' ? 'alert' : 'status'}
          className="pointer-events-auto flex max-w-md items-center gap-3 rounded-xl border px-4 py-2.5 text-sm shadow-xl"
          style={{
            background: t.tone === 'error' ? 'var(--t-red-bg)' : 'var(--c-ink)',
            color: t.tone === 'error' ? 'var(--t-red-fg)' : 'var(--c-bg)',
          }}
        >
          <span>{t.text}</span>
          {t.undoable && (
            <button className="font-semibold underline" onClick={() => { undo(); dismiss(t.id); }}>
              Undo
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- confirm

interface ConfirmReq {
  title: string;
  body?: ReactNode;
  confirm: string;
  danger?: boolean;
  /** If set, the person must type this word before the action is allowed. */
  typed?: string;
  resolve: (ok: boolean) => void;
}
let pending: ConfirmReq | null = null;
const csubs = new Set<() => void>();

export function confirmDialog(o: { title: string; body?: ReactNode; confirm?: string; danger?: boolean; typed?: string }): Promise<boolean> {
  return new Promise((resolve) => {
    pending = { title: o.title, body: o.body, confirm: o.confirm ?? 'Confirm', danger: o.danger, typed: o.typed, resolve };
    csubs.forEach((s) => s());
  });
}

export function ConfirmHost() {
  const req = useSyncExternalStore((l) => { csubs.add(l); return () => csubs.delete(l); }, () => pending);
  const [, force] = useState(0);
  const [typed, setTyped] = useState('');
  useEffect(() => { force((x) => x + 1); setTyped(''); }, [req]);
  if (!req) return null;
  const close = (ok: boolean) => {
    req.resolve(ok);
    pending = null;
    csubs.forEach((s) => s());
  };
  return (
    <Modal
      size="sm"
      title={req.title}
      onClose={() => close(false)}
      footer={
        <>
          <Button onClick={() => close(false)}>Cancel</Button>
          <Button variant={req.danger ? 'danger-solid' : 'primary'} className="autofocus" disabled={!!req.typed && typed.trim().toLowerCase() !== req.typed.toLowerCase()} onClick={() => close(true)}>{req.confirm}</Button>
        </>
      }
    >
      <div className="text-sm text-muted">{req.body}</div>
      {req.typed && (
        <label className="mt-3 block text-sm">
          Type <b>{req.typed}</b> to confirm
          <input className="input mt-1" autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} />
        </label>
      )}
    </Modal>
  );
}
