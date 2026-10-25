import { mockClasses, mockTimetable } from '../../data/mock/timetable';
import type { TimetableService } from './service';
import { slotKey } from './utils';

/** Holds the timetable in memory for the session. Changes are lost on reload. */
export function createMemoryTimetableService(): TimetableService {
  let data = structuredClone(mockTimetable);

  return {
    getClasses: async () => structuredClone(mockClasses),
    getTimetable: async () => structuredClone(data),
    setAssignment: async (slot, assignment) => {
      const assignments = { ...data.assignments };
      const key = slotKey(slot.day, slot.periodId);
      if (assignment) assignments[key] = assignment;
      else delete assignments[key];
      data = { ...data, assignments };
      return structuredClone(data);
    },
  };
}
