/** sessionStorage that never throws (private windows, blocked storage): falls back to memory for this page load. */
const mem = new Map<string, string>();
export const session = {
  get(key: string): string | null {
    try { return window.sessionStorage.getItem(key); } catch { return mem.get(key) ?? null; }
  },
  set(key: string, value: string) {
    try { window.sessionStorage.setItem(key, value); } catch { mem.set(key, value); }
  },
  remove(key: string) {
    try { window.sessionStorage.removeItem(key); } catch { mem.delete(key); }
    mem.delete(key);
  },
};
