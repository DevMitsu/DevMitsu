import { CircleAlert, CloudOff, LoaderCircle } from 'lucide-react';
import { isConnected } from '../../sync/config';
import { useSyncState } from '../../sync/status';
import { cn } from '../../lib/cn';

/** Shows that this device is live with the shared database. */
export function SyncPill() {
  const { status, detail } = useSyncState();
  if (!isConnected) return null;
  const view = {
    live: { text: 'Live', icon: <span aria-hidden className="size-2 rounded-full bg-primary" />, cls: 'border-line text-muted' },
    saving: { text: 'Saving…', icon: <LoaderCircle className="size-3.5 animate-spin" aria-hidden />, cls: 'border-line text-muted' },
    connecting: { text: 'Connecting…', icon: <LoaderCircle className="size-3.5 animate-spin" aria-hidden />, cls: 'border-line text-muted' },
    offline: { text: 'Offline', icon: <CloudOff className="size-3.5" aria-hidden />, cls: 'border-amber/50 bg-amber-soft text-ink' },
    error: { text: 'Problem', icon: <CircleAlert className="size-3.5" aria-hidden />, cls: 'border-amber/50 bg-amber-soft text-ink' },
  }[status];
  return (
    <span role="status" title={detail} className={cn('hidden h-8 items-center gap-1.5 rounded-control border px-2.5 text-xs font-medium sm:inline-flex', view.cls)}>
      {view.icon}{view.text}
    </span>
  );
}
