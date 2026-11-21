import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { computeAlerts, type Alert } from '../domain/alerts';
import { ALL } from '../domain/inventory';
import { useStore } from '../store/store';

const Ctx = createContext<Alert[]>([]);

export function AlertsProvider({ children }: { children: ReactNode }) {
  const state = useStore((s) => s);
  const alerts = useMemo(() => computeAlerts(state), [state]);
  return <Ctx.Provider value={alerts}>{children}</Ctx.Provider>;
}

export function useAlerts(scope: string): Alert[] {
  const all = useContext(Ctx);
  const labs = useStore((s) => s.labs);
  return useMemo(() => all.filter((a) => (scope === ALL || a.labId === scope) && labs.some((l) => l.id === a.labId && !l.archived)), [all, scope, labs]);
}
