import type { Assignment, ClassGroup, SlotRef, TimetableData } from './types';

/**
 * The only seam between the timetable UI and wherever its data lives.
 * Stage 1 uses an in-memory implementation; a later stage can supply one backed by an API
 * without touching any component.
 */
export interface TimetableService {
  getClasses(): Promise<ClassGroup[]>;
  getTimetable(): Promise<TimetableData>;
  /** Pass null to clear the slot. Resolves with the updated timetable. */
  setAssignment(slot: SlotRef, assignment: Assignment | null): Promise<TimetableData>;
}
