import { useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ALL, activeLabs } from '../domain/inventory';
import { useStore } from '../store/store';

/** The lab being looked at ('all' for every lab), taken from the URL. */
export function useScope() {
  const { scope = ALL } = useParams();
  const allLabs = useStore((s) => s.labs);
  const labs = useMemo(() => activeLabs({ labs: allLabs }), [allLabs]);
  const lab = labs.find((l) => l.id === scope);
  return { scope: lab ? lab.id : ALL, lab, labs };
}

export function useGo() {
  const { scope } = useScope();
  const navigate = useNavigate();
  return useCallback((path = '') => navigate(`/${scope}${path ? `/${path}` : ''}`), [navigate, scope]);
}

export const scopePath = (scope: string, path = '') => `/${scope}${path ? `/${path}` : ''}`;

/** The lab a new entry should go to: the current lab, or the first one when looking at all. */
export function useDefaultLab(): string {
  const { scope, labs } = useScope();
  return scope !== ALL ? scope : (labs[0]?.id ?? '');
}
