export type DayId = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

export interface Period {
  id: string;
  label: string;
  /** 24-hour "HH:MM". */
  start: string;
  end: string;
  /** Breaks are shown in the grid but cannot be assigned. */
  kind: 'teaching' | 'break';
}

export interface ClassGroup {
  id: string;
  name: string;
  sections: string[];
}

export interface Assignment {
  classId: string;
  section: string;
}

export interface SlotRef {
  day: DayId;
  periodId: string;
}

export interface TimetableData {
  days: DayId[];
  periods: Period[];
  /** Keyed by slotKey(day, periodId). Missing key = unscheduled. */
  assignments: Record<string, Assignment>;
}
