import { useEffect, useRef, useState, type ReactNode } from 'react';
import { LoaderCircle, Lock } from 'lucide-react';
import { SchoolLogo } from '../components/SchoolLogo';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/Field';
import { ToastHost } from '../components/ui/toast';
import { LIBRARIES } from '../domain/rules';
import type { LibraryId } from '../domain/types';
import { ConnectionSetup } from '../features/settings/ConnectionCard';
import { cn } from '../lib/cn';
import { session as store } from '../lib/session';
import { switchLibrary } from '../store/actions';
import { getState, useStore } from '../store/store';
import { initAuth, signIn, signOut, useAuth } from '../sync/auth';
import { config, DEFAULT_USERNAMES, isConnected, libraryList } from '../sync/config';
import { startSync, stopSync } from '../sync/controller';
import { useSyncState } from '../sync/status';

const PREFER_KEY = 'alx-prefer-lib';
const NOTICE_KEY = 'alx-notice';

/** Sign out and come back to the front door, with the chosen library ready to sign in to. */
export async function signOutTo(lib?: LibraryId, notice?: string) {
  if (lib) store.set(PREFER_KEY, lib);
  if (notice) store.set(NOTICE_KEY, notice);
  await signOut();
}

const BACKGROUND = 'bg-[linear-gradient(155deg,#0c2238_0%,#17497a_55%,#2b6cb0_100%)]';

function LoginDialog({ initialLibrary, onClose }: { initialLibrary: LibraryId; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [lib, setLib] = useState<LibraryId>(initialLibrary);
  const [username, setUsername] = useState('');
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState(false);

  useEffect(() => { ref.current?.showModal(); }, []);
  const choose = (l: LibraryId) => { setLib(l); setError(''); setUsername(''); setPw(''); };
  const go = async () => {
    setBusy(true); setError('');
    const r = await signIn(lib, username, pw);
    setBusy(false);
    if (!r.ok) setError(r.error ?? 'Could not sign in.');
  };

  return (
    <dialog
      ref={ref}
      aria-label="Sign in"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(26rem,calc(100vw-1.5rem))] rounded-panel border border-line bg-panel p-0 text-ink backdrop:bg-[#0c2238]/70"
    >
      {setup ? (
        <div className="p-5"><ConnectionSetup onDone={() => setSetup(false)} /></div>
      ) : (
        <form className="px-6 pt-6 pb-5" onSubmit={(e) => { e.preventDefault(); void go(); }}>
          <div className="mb-4 flex justify-center text-navy"><SchoolLogo className="h-24 w-auto max-w-48 object-contain" /></div>
          <h1 className="mb-4 text-center text-lg font-semibold">Sign in</h1>

          <div role="group" aria-label="Library" className="mb-4 grid grid-cols-2 gap-1 rounded-control border border-line bg-canvas p-1">
            {(['sr', 'jr'] as LibraryId[]).map((l) => {
              const on = libraryList.includes(l);
              return (
                <button key={l} type="button" disabled={!on} aria-pressed={lib === l} onClick={() => choose(l)}
                  className={cn('h-10 rounded-[6px] text-sm font-medium transition-colors', lib === l ? 'bg-panel text-accent shadow-[0_0_0_1px_var(--color-line)]' : 'text-muted hover:text-ink', !on && 'cursor-not-allowed opacity-50')}>
                  {LIBRARIES[l].label}
                  {!on && <span className="block text-[10px] font-normal">Not set up yet</span>}
                </button>
              );
            })}
          </div>

          <div className="space-y-3">
            <TextField label="Username" value={username} onChange={(v) => { setUsername(v); setError(''); }} placeholder={DEFAULT_USERNAMES[lib]} autoComplete="username" autoCapitalize="none" autoFocus />
            <TextField label="Password" type="password" value={pw} onChange={(v) => { setPw(v); setError(''); }} autoComplete="current-password" error={error} />
          </div>
          <Button type="submit" variant="primary" className="mt-4 w-full" loading={busy} icon={<Lock className="size-4" aria-hidden />}>Sign in</Button>

          {!isConnected && <p className="mt-3 rounded-control bg-canvas px-3 py-2 text-center text-xs text-muted">Demo: username <span className="font-medium text-ink">{DEFAULT_USERNAMES[lib]}</span>, password <span className="font-medium text-ink">{lib}123</span></p>}
          {config?.mode === 'memory' && <p className="mt-3 text-center text-xs text-muted">Test mode: data is shared between tabs of this browser only.</p>}
          <button type="button" onClick={() => setSetup(true)} className="mx-auto mt-3 block text-xs text-muted underline underline-offset-2">Connection settings</button>
        </form>
      )}
    </dialog>
  );
}

/** The page everyone sees first: the school logo on blue. Click it to sign in. */
function FrontDoor() {
  const preferred = (store.get(PREFER_KEY) as LibraryId | null) ?? (libraryList.includes('sr') ? 'sr' : libraryList[0] ?? 'sr');
  const [open, setOpen] = useState(() => store.get(PREFER_KEY) !== null);
  const [notice] = useState(() => store.get(NOTICE_KEY));
  useEffect(() => { store.remove(PREFER_KEY); store.remove(NOTICE_KEY); }, []);

  return (
    <div className={cn('relative grid min-h-screen place-items-center overflow-hidden px-4 py-10', BACKGROUND)}>
      <button type="button" onClick={() => setOpen(true)} aria-label="Click the school logo to sign in"
        className="group rounded-full p-4 text-white outline-offset-8 focus-visible:outline-white">
        <SchoolLogo className="max-h-[62vh] w-[min(72vw,24rem)] object-contain drop-shadow-[0_12px_32px_rgba(0,0,0,0.35)] transition-transform duration-200 group-hover:scale-[1.03] motion-reduce:transition-none" />
      </button>
      <p className="absolute bottom-8 left-0 right-0 px-4 text-center text-sm text-white/75">{notice ?? 'Click the logo to sign in'}</p>
      {open && <LoginDialog initialLibrary={preferred} onClose={() => setOpen(false)} />}
      <ToastHost />
    </div>
  );
}

function Splash({ children }: { children: ReactNode }) {
  return (
    <div className={cn('grid min-h-screen place-items-center px-4 text-white', BACKGROUND)}>
      <div className="flex flex-col items-center gap-5 text-center">
        <SchoolLogo className="h-28 w-auto max-w-56 object-contain opacity-90" />
        {children}
      </div>
      <ToastHost />
    </div>
  );
}

/** Everything sits behind the front door. When connected to the shared database, it also loads the data before showing the app. */
export function AppGate({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const sync = useSyncState();
  useEffect(() => { void initAuth(); }, []);

  const lib = auth.session?.library;
  const activeLibrary = useStore((st) => st.activeLibrary);
  useEffect(() => {
    if (lib) { switchLibrary(lib); if (isConnected) void startSync(); }
    else if (isConnected) void stopSync();
  }, [lib]);

  // sign out after a period with no activity
  useEffect(() => {
    if (!lib) return;
    let last = Date.now();
    const bump = () => { last = Date.now(); };
    const events = ['pointerdown', 'keydown', 'mousemove', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const timer = window.setInterval(() => {
      const mins = getState().prefs.idleMinutes;
      if (mins > 0 && Date.now() - last > mins * 60_000) void signOutTo(undefined, `Signed out after ${mins} minutes without activity.`);
    }, 20_000);
    return () => { events.forEach((e) => window.removeEventListener(e, bump)); window.clearInterval(timer); };
  }, [lib]);

  if (!auth.ready) return <Splash><LoaderCircle className="size-5 animate-spin" aria-hidden /></Splash>;
  if (!auth.session) return <FrontDoor />;
  // never show the app for a library other than the one signed in to, even for a moment
  if (activeLibrary !== lib) return <Splash><LoaderCircle className="size-5 animate-spin" aria-hidden /></Splash>;
  if (isConnected && !sync.loaded) {
    if (sync.status === 'error') {
      return (
        <Splash>
          <div className="max-w-sm space-y-3 rounded-panel bg-white/95 p-5 text-left text-sm text-ink">
            <p className="font-semibold">Could not load the library.</p>
            <p>{sync.detail}</p>
            <p className="text-muted">Sign out and check the connection settings, or run the connection test in Settings.</p>
            <div className="flex gap-2"><Button onClick={() => { void stopSync().then(() => startSync()); }}>Try again</Button><Button variant="ghost" onClick={() => void signOutTo()}>Sign out</Button></div>
          </div>
        </Splash>
      );
    }
    return <Splash><p className="flex items-center gap-2 text-sm text-white/85"><LoaderCircle className="size-4 animate-spin" aria-hidden />Loading your library…</p></Splash>;
  }
  return <>{children}</>;
}
