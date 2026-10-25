import type { Assignment, ClassGroup, DayId, Period, SlotRef, TimetableData } from './types';

export const DAY_LABELS: Record<DayId, { short: string; long: string }> = {
  mon: { short: 'Mon', long: 'Monday' },
  tue: { short: 'Tue', long: 'Tuesday' },
  wed: { short: 'Wed', long: 'Wednesday' },
  thu: { short: 'Thu', long: 'Thursday' },
  fri: { short: 'Fri', long: 'Friday' },
  sat: { short: 'Sat', long: 'Saturday' },
};

const JS_DAY_TO_ID: Array<DayId | null> = [null, 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export const slotKey = (day: DayId, periodId: string) => `${day}:${periodId}`;

export function getAssignment(data: TimetableData, slot: SlotRef): Assignment | undefined {
  return data.assignments[slotKey(slot.day, slot.periodId)];
}

/** The timetable day for a date, or null when the date is not a school day. */
export function schoolDayOf(date: Date, days: DayId[]): DayId | null {
  const id = JS_DAY_TO_ID[date.getDay()];
  return id && days.includes(id) ? id : null;
}

/**
 * Which day the "Today" view should display.
 * On a non-school day it falls back to the next school day and says so.
 */
export function resolveDisplayDay(date: Date, days: DayId[]): { day: DayId; isFallback: boolean } {
  const today = schoolDayOf(date, days);
  if (today) return { day: today, isFallback: false };
  return { day: days[0]!, isFallback: true };
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h! * 60 + m!;
};

export function currentPeriodId(date: Date, periods: Period[]): string | null {
  const minutes = date.getHours() * 60 + date.getMinutes();
  const match = periods.find((p) => minutes >= toMinutes(p.start) && minutes < toMinutes(p.end));
  return match?.id ?? null;
}

export function hasPeriodEnded(date: Date, period: Period): boolean {
  return date.getHours() * 60 + date.getMinutes() >= toMinutes(period.end);
}

export const formatRange = (p: Period) => `${p.start} – ${p.end}`;

/** "7-B" (short) or "Class 7 · Section B" (long). */
export function formatAssignment(
  a: Assignment,
  classes: ClassGroup[],
  style: 'short' | 'long' = 'long',
): string {
  const name = classes.find((c) => c.id === a.classId)?.name ?? 'Unknown class';
  if (style === 'long') return `${name} · Section ${a.section}`;
  return `${name.replace(/^Class\s+/, '')}-${a.section}`;
}

export function firstFreeSlot(data: TimetableData, day: DayId): SlotRef {
  const free = data.periods.find(
    (p) => p.kind === 'teaching' && !data.assignments[slotKey(day, p.id)],
  );
  const fallback = data.periods.find((p) => p.kind === 'teaching')!;
  return { day, periodId: (free ?? fallback).id };
}
