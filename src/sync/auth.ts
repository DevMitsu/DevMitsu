import { useSyncExternalStore } from 'react';
import { LIBRARIES } from '../domain/rules';
import { session as store } from '../lib/session';
import type { LibraryId } from '../domain/types';
import { changePassword as changeLocalPassword, checkPassword } from '../store/actions';
import { config, emailFor, isConnected, usernames } from './config';
import { supabase } from './supabaseRemote';

export interface Session { library: LibraryId; username: string }
export interface AuthState { ready: boolean; session: Session | null }
let state: AuthState = { ready: false, session: null };
const listeners = new Set<() => void>();
const set = (s: AuthState) => { state = s; listeners.forEach((l) => l()); };
export const useAuth = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state);
export const getAuth = () => state;

const SESSION_KEY = 'alx-session';          // lasts until the tab or browser is closed
const MEM_PW = 'alx-memory-passwords';      // test mode only
const memPasswords = (): Record<LibraryId, string> => { try { return { jr: 'jr123', sr: 'sr123', ...JSON.parse(localStorage.getItem(MEM_PW) ?? '{}') }; } catch { return { jr: 'jr123', sr: 'sr123' }; } };

const libraryOfUsername = (u: string): LibraryId | null => (Object.keys(usernames) as LibraryId[]).find((l) => usernames[l] === u.trim().toLowerCase()) ?? null;
const readSession = (): Session | null => { try { return JSON.parse(store.get(SESSION_KEY) ?? 'null'); } catch { return null; } };

export async function initAuth() {
  if (!isConnected || config?.mode === 'memory') { set({ ready: true, session: readSession() }); return; }
  const db = supabase();
  const fromSupabase = (email: string | undefined | null): Session | null => {
    const username = email?.split('@')[0] ?? '';
    const library = libraryOfUsername(username);
    return library ? { library, username } : null;
  };
  const { data } = await db.auth.getSession();
  set({ ready: true, session: fromSupabase(data.session?.user.email) });
  db.auth.onAuthStateChange((_e, session) => set({ ready: true, session: fromSupabase(session?.user.email) }));
}

export async function signIn(lib: LibraryId, username: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const u = username.trim().toLowerCase();
  if (!u || !password) return { ok: false, error: 'Enter the username and the password.' };
  if (libraryOfUsername(u) !== lib) return { ok: false, error: `That username is not for the ${LIBRARIES[lib].label}.` };
  const finish = () => { const session = { library: lib, username: u }; store.set(SESSION_KEY, JSON.stringify(session)); set({ ready: true, session }); return { ok: true as const }; };
  if (!isConnected) return checkPassword(lib, password) ? finish() : { ok: false, error: 'The username or password is not correct.' };
  if (config?.mode === 'memory') return memPasswords()[lib] === password ? finish() : { ok: false, error: 'The username or password is not correct.' };
  const { error } = await supabase().auth.signInWithPassword({ email: emailFor(u), password });
  if (error) {
    const msg = /invalid login|invalid credentials/i.test(error.message) ? 'The username or password is not correct.' : /fetch|network/i.test(error.message) ? 'Could not reach the database. Check the internet connection.' : error.message;
    return { ok: false, error: msg };
  }
  return { ok: true };   // the auth listener sets the session
}

export async function signOut() {
  store.remove(SESSION_KEY);
  if (isConnected && config?.mode === 'supabase') await supabase().auth.signOut();
  set({ ready: true, session: null });
}

/** Checks the signed-in library's password again, without changing who is signed in. */
export async function verifyPassword(password: string): Promise<boolean> {
  const s = state.session;
  if (!s) return false;
  if (!isConnected) return checkPassword(s.library, password);
  if (config?.mode === 'memory') return memPasswords()[s.library] === password;
  const { error } = await supabase().auth.signInWithPassword({ email: emailFor(s.username), password });
  return !error;
}

export async function changeLibraryPassword(oldPw: string, newPw: string, confirm: string): Promise<{ ok: boolean; errors: string[] }> {
  const s = state.session;
  if (!s) return { ok: false, errors: ['Sign in first.'] };
  if (!isConnected) { const r = changeLocalPassword(s.library, oldPw, newPw, confirm); return { ok: r.ok, errors: r.errors }; }
  if (!(await verifyPassword(oldPw))) return { ok: false, errors: ['The old password is not correct.'] };
  if (newPw.length < 6) return { ok: false, errors: ['Use at least 6 characters for the new password.'] };
  if (newPw !== confirm) return { ok: false, errors: ['The new password and its confirmation do not match.'] };
  if (newPw === oldPw) return { ok: false, errors: ['Choose a password different from the old one.'] };
  if (config?.mode === 'memory') { localStorage.setItem(MEM_PW, JSON.stringify({ ...memPasswords(), [s.library]: newPw })); return { ok: true, errors: [] }; }
  const { error } = await supabase().auth.updateUser({ password: newPw });
  return error ? { ok: false, errors: [error.message] } : { ok: true, errors: [] };
}
