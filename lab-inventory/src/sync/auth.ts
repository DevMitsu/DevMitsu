import { useSyncExternalStore } from 'react';
import { config, emailFor, isConnected } from './config';
import { supabase } from './supabaseRemote';

export interface Session { username: string }
export interface AuthState { ready: boolean; session: Session | null }
let state: AuthState = { ready: false, session: null };
const listeners = new Set<() => void>();
const set = (s: AuthState) => { state = s; listeners.forEach((l) => l()); };
export const useAuth = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state);
export const getAuth = () => state;

const MEM_SESSION = 'labinventory-memory-session'; // test mode only; lasts until the tab is closed
const MEM_PASSWORD = 'lab123'; // test mode only

const usernameOf = (email: string | undefined | null): string | null => {
  const e = (email ?? '').toLowerCase();
  const [name, domain] = e.split('@');
  return name && domain === 'lab-inventory-app.com' ? name : null;
};

export async function initAuth() {
  if (!isConnected) { set({ ready: true, session: null }); return; }
  if (config?.mode === 'memory') {
    const u = sessionStorage.getItem(MEM_SESSION);
    set({ ready: true, session: u ? { username: u } : null });
    return;
  }
  const db = supabase();
  const { data } = await db.auth.getSession();
  const u = usernameOf(data.session?.user.email);
  set({ ready: true, session: u ? { username: u } : null });
  db.auth.onAuthStateChange((_e, session) => {
    const name = usernameOf(session?.user.email);
    set({ ready: true, session: name ? { username: name } : null });
  });
}

export async function signIn(username: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const u = username.trim().toLowerCase();
  if (!u || !password) return { ok: false, error: 'Enter your username and password.' };
  if (!/^[a-z0-9._-]+$/.test(u)) return { ok: false, error: 'A username has only letters, numbers, dots, dashes and underscores (for example ms-sharma).' };
  if (config?.mode === 'memory') {
    if (password !== MEM_PASSWORD) return { ok: false, error: 'The username or password is not correct.' };
    sessionStorage.setItem(MEM_SESSION, u);
    set({ ready: true, session: { username: u } });
    return { ok: true };
  }
  const { error } = await supabase().auth.signInWithPassword({ email: emailFor(u), password });
  if (error) {
    const msg = /invalid login|invalid credentials/i.test(error.message) ? 'The username or password is not correct.'
      : /fetch|network/i.test(error.message) ? 'Could not reach the database. Check the internet connection.' : error.message;
    return { ok: false, error: msg };
  }
  return { ok: true }; // the auth listener sets the session
}

export async function signOut() {
  sessionStorage.removeItem(MEM_SESSION);
  if (config?.mode === 'supabase') await supabase().auth.signOut();
  set({ ready: true, session: null });
}
