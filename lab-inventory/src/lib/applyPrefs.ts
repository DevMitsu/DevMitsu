import { useEffect } from 'react';
import { useStore } from '../store/store';

/** Applies theme, text size and density to the page. */
export function useApplyPrefs() {
  const { theme, textSize, compact } = useStore((s) => s.settings);
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply = () => root.setAttribute('data-theme', theme === 'system' ? (mq?.matches ? 'dark' : 'light') : theme);
    apply();
    mq?.addEventListener?.('change', apply);
    return () => mq?.removeEventListener?.('change', apply);
  }, [theme]);
  useEffect(() => {
    document.documentElement.setAttribute('data-text', textSize);
    document.documentElement.setAttribute('data-compact', String(compact));
  }, [textSize, compact]);
}
