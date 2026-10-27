import { useSyncExternalStore } from 'react';
import { CircleAlert, CircleCheck, X } from 'lucide-react';
import type { Result } from '../../store/actions';

interface Toast {
  id: number;
  tone: 'ok' | 'error';
  message: string;
  action?: { label: string; run: () => void };
}
let toasts: Toast[] = [];
let n = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(message: string, opts?: { tone?: 'ok' | 'error'; action?: Toast['action']; ms?: number }) {
  const t: Toast = { id: ++n, tone: opts?.tone ?? 'ok', message, action: opts?.action };
  toasts = [...toasts, t];
  emit();
  window.setTimeout(() => dismiss(t.id), opts?.ms ?? (opts?.action ? 12_000 : 5_000));
}
export function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}
/** Show the outcome of an action. Returns true when it succeeded. */
export function notify(r: Result, okMessage?: string): boolean {
  if (r.ok) toast(okMessage ?? r.message ?? 'Done.');
  else toast(r.errors[0] ?? 'That did not work.', { tone: 'error' });
  return r.ok;
}

export function ToastHost() {
  const list = useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => toasts);
  return (
    <div className="pointer-events-none fixed right-3 bottom-3 left-3 z-[100] flex flex-col items-end gap-2 sm:left-auto" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-panel border border-line bg-navy px-4 py-3 text-sm text-white">
          {t.tone === 'ok' ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-sage" aria-hidden /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber" aria-hidden />}
          <span className="flex-1">{t.message}</span>
          {t.action && (
            <button type="button" className="font-medium text-sage underline underline-offset-2" onClick={() => { t.action!.run(); dismiss(t.id); }}>
              {t.action.label}
            </button>
          )}
          <button type="button" aria-label="Dismiss" className="text-navy-text hover:text-white" onClick={() => dismiss(t.id)}>
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
