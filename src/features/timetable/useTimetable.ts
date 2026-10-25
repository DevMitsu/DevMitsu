import { useCallback, useEffect, useMemo, useState } from 'react';
import { createMemoryTimetableService } from './memoryService';
import type { TimetableService } from './service';
import type { Assignment, ClassGroup, SlotRef, TimetableData } from './types';

export type TimetableState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: TimetableData; classes: ClassGroup[] };

/** Loads the timetable from a service and exposes a save action. */
export function useTimetable(service?: TimetableService) {
  const svc = useMemo(() => service ?? createMemoryTimetableService(), [service]);
  const [state, setState] = useState<TimetableState>({ status: 'loading' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setState({ status: 'loading' });
    Promise.all([svc.getTimetable(), svc.getClasses()])
      .then(([data, classes]) => setState({ status: 'ready', data, classes }))
      .catch(() => setState({ status: 'error', message: 'The timetable could not be loaded.' }));
  }, [svc]);

  useEffect(load, [load]);

  const setAssignment = useCallback(
    async (slot: SlotRef, assignment: Assignment | null) => {
      setSaving(true);
      try {
        const data = await svc.setAssignment(slot, assignment);
        setState((prev) => (prev.status === 'ready' ? { ...prev, data } : prev));
      } finally {
        setSaving(false);
      }
    },
    [svc],
  );

  return { state, saving, reload: load, setAssignment };
}
