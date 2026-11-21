/**
 * How this copy of the app connects to its shared database.
 * No config = the standalone app that keeps data in this browser only.
 */
export interface SyncConfig {
  /** 'supabase' is the real shared database. 'memory' shares data between tabs of one browser, for trying and testing sync. */
  mode: 'supabase' | 'memory';
  url?: string;
  /** The public ("anon") key. It is safe to expose: the database only answers staff logins. */
  anonKey?: string;
}

/** Usernames become sign-in emails on this made-up domain. No email is ever sent. */
export const LOGIN_DOMAIN = 'lab-inventory-app.com';
export const emailFor = (username: string) => `${username.trim().toLowerCase()}@${LOGIN_DOMAIN}`;

declare global {
  interface Window { LAB_INVENTORY_CONFIG?: Partial<SyncConfig> }
}

export const CONFIG_KEY = 'labinventory-config';

export function normalise(raw: Partial<SyncConfig> | null | undefined): SyncConfig | null {
  if (!raw || (raw.mode !== 'supabase' && raw.mode !== 'memory')) return null;
  if (raw.mode === 'supabase' && (!raw.url || !raw.anonKey || /PASTE-YOUR/i.test(raw.url + raw.anonKey))) return null;
  return { mode: raw.mode, url: raw.url?.trim().replace(/\/+$/, ''), anonKey: raw.anonKey?.trim() };
}

function load(): SyncConfig | null {
  if (typeof window === 'undefined') return null;
  // 1. a config.js file placed next to the page (or baked in at build time), 2. what was typed in on this computer
  const fromFile = normalise(window.LAB_INVENTORY_CONFIG);
  if (fromFile) return fromFile;
  try {
    const raw = window.localStorage.getItem(CONFIG_KEY);
    return raw ? normalise(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export const config: SyncConfig | null = load();
export const isConnected = config !== null;
/** True when the settings came from config.js rather than being typed in here: they cannot be removed from inside the app. */
export const configIsFixed = typeof window !== 'undefined' && normalise(window.LAB_INVENTORY_CONFIG) !== null;

export function saveConfig(c: SyncConfig) {
  window.localStorage.setItem(CONFIG_KEY, JSON.stringify(c));
}
export function clearConfig() {
  window.localStorage.removeItem(CONFIG_KEY);
}

/** Checks a URL and key look right before they are saved, and says what is wrong. */
export function checkConfigInput(url: string, key: string): string | null {
  const u = url.trim();
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/?$/i.test(u) && !/^https:\/\/[^\s/]+\.[^\s/]+\/?$/i.test(u)) {
    return 'The URL should look like https://abcdefgh.supabase.co (the Project URL in Supabase → Project Settings → API).';
  }
  const k = key.trim();
  if (k.length < 30) return 'The key looks too short. Copy the whole "anon public" key.';
  if (/service_role/i.test(k) || (k.split('.').length === 3 && safeRole(k) === 'service_role')) {
    return 'That is the service_role key, which must never be used here. Use the "anon public" key instead.';
  }
  return null;
}

function safeRole(jwt: string): string | undefined {
  try {
    return (JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { role?: string }).role;
  } catch {
    return undefined;
  }
}
