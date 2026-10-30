import { useEffect } from 'react';
import type { Prefs } from '../domain/types';
import { useStore } from '../store/store';

/** Writes the display preferences onto <html>. Uses its own attributes so the host page's theme is untouched. */
export function applyPrefs(p: Prefs) {
  const el = document.documentElement;
  el.setAttribute('data-alx-theme', p.theme);
  el.setAttribute('data-alx-text', p.textSize);
  el.setAttribute('data-alx-density', p.compact ? 'compact' : 'comfortable');
}

export function useApplyPrefs() {
  const prefs = useStore((s) => s.prefs);
  useEffect(() => applyPrefs(prefs), [prefs]);
}
