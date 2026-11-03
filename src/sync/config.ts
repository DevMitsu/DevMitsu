import { gradesFor } from '../domain/rules';
import type { LibraryId } from '../domain/types';

/**
 * How this copy of the app connects to its shared database.
 * No config = the standalone demo that keeps data in this browser only.
 */
export interface SyncConfig {
  /** 'supabase' is the real shared database. 'memory' shares data between tabs of one browser, for trying and testing sync. */
  mode: 'supabase' | 'memory';
  url?: string;
  /** The public ("anon") key. It is safe to expose: the database only answers library logins. */
  anonKey?: string;
  /** Libraries switched on for this school. The Jr. Library is added when its data is ready. */
  libraries: LibraryId[];
  /** The username for each library. Each library has its own username and password. */
  usernames: Record<LibraryId, string>;
}

export const DEFAULT_USERNAMES: Record<LibraryId, string> = { sr: 'sr-library', jr: 'jr-library' };
/** Usernames become sign-in emails on this made-up domain. No email is ever sent. */
export const LOGIN_DOMAIN = 'alexandria-app.com';
export const emailFor = (username: string) => `${username.trim().toLowerCase()}@${LOGIN_DOMAIN}`;

declare global {
  interface Window { ALEXANDRIA_CONFIG?: Partial<SyncConfig> }
}

const KEY = 'alexandria-config';

function normalise(raw: Partial<SyncConfig> | null | undefined): SyncConfig | null {
  if (!raw || (raw.mode !== 'supabase' && raw.mode !== 'memory')) return null;
  if (raw.mode === 'supabase' && (!raw.url || !raw.anonKey)) return null;
  return {
    mode: raw.mode,
    url: raw.url?.trim().replace(/\/+$/, ''),
    anonKey: raw.anonKey?.trim(),
    libraries: raw.libraries?.length ? raw.libraries : ['sr'],
    usernames: { ...DEFAULT_USERNAMES, ...(raw.usernames ?? {}) },
  };
}

function load(): SyncConfig | null {
  if (typeof window === 'undefined') return null;
  // 1. a config.js file placed next to the page, 2. what was typed in on this device
  const fromFile = normalise(window.ALEXANDRIA_CONFIG);
  if (fromFile) return fromFile;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? normalise(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export const config: SyncConfig | null = load();
export const isConnected = config !== null;
export const enabledLibraries: LibraryId[] = config?.libraries ?? ['jr', 'sr'];
export const usernames: Record<LibraryId, string> = config?.usernames ?? DEFAULT_USERNAMES;

export function saveConfig(c: Partial<SyncConfig>) {
  window.localStorage.setItem(KEY, JSON.stringify(c));
}
export function clearConfig() {
  window.localStorage.removeItem(KEY);
}

/** Libraries switched on, in display order. */
export const libraryList: LibraryId[] = (['jr', 'sr'] as LibraryId[]).filter((l) => enabledLibraries.includes(l));
/** Class numbers that belong to the libraries switched on. */
export const enabledGrades: number[] = libraryList.flatMap((l) => gradesFor(l));
