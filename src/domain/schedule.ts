import type { DayId } from './types';

export interface Period {
  id: string;
  label: string;
  /** 24-hour "HH:MM". */
  start: string;
  end: string;
  kind: 'lecture' | 'break';
  tag?: string;
}

/** The school day: 11 bookable lectures plus breakfast, a buffer and reflection time. */
export const PERIODS: Period[] = [
  { id: 'l1', label: 'Lecture 1', start: '08:05', end: '08:35', kind: 'lecture' },
  { id: 'l2', label: 'Lecture 2', start: '08:35', end: '09:15', kind: 'lecture' },
  { id: 'breakfast', label: 'Breakfast break', start: '09:15', end: '09:30', kind: 'break' },
  { id: 'l3', label: 'Lecture 3', start: '09:30', end: '10:00', kind: 'lecture' },
  { id: 'l4', label: 'Lecture 4', start: '10:00', end: '10:40', kind: 'lecture' },
  { id: 'buffer', label: 'Buffer', start: '10:40', end: '10:45', kind: 'break' },
  { id: 'l5', label: 'Lecture 5', start: '10:45', end: '11:15', kind: 'lecture' },
  { id: 'l6', label: 'Lecture 6', start: '11:15', end: '11:55', kind: 'lecture' },
  { id: 'l7', label: 'Lecture 7', start: '11:55', end: '12:35', kind: 'lecture' },
  { id: 'l8', label: 'Lecture 8', start: '12:35', end: '13:05', kind: 'lecture' },
  { id: 'l9', label: 'Lecture 9', start: '13:05', end: '13:35', kind: 'lecture', tag: 'Lunch' },
  { id: 'l10', label: 'Lecture 10', start: '13:35', end: '14:05', kind: 'lecture' },
  { id: 'l11', label: 'Lecture 11', start: '14:05', end: '14:35', kind: 'lecture' },
  { id: 'reflection', label: 'Reflection time', start: '14:35', end: '14:40', kind: 'break' },
];

export const LECTURES = PERIODS.filter((p) => p.kind === 'lecture');
export const DAYS: DayId[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export const DAY_LABELS: Record<DayId, { short: string; long: string }> = {
  mon: { short: 'Mon', long: 'Monday' },
  tue: { short: 'Tue', long: 'Tuesday' },
  wed: { short: 'Wed', long: 'Wednesday' },
  thu: { short: 'Thu', long: 'Thursday' },
  fri: { short: 'Fri', long: 'Friday' },
  sat: { short: 'Sat', long: 'Saturday' },
};

export const periodById = (id: string) => PERIODS.find((p) => p.id === id);

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h! * 60 + m!;
};

/** "13:05" -> "1:05". Pass withMeridiem for "1:05 PM". */
export function formatTime(hhmm: string, withMeridiem = false): string {
  const [h, m] = hhmm.split(':').map(Number);
  const hour12 = h! % 12 === 0 ? 12 : h! % 12;
  const base = `${hour12}:${String(m).padStart(2, '0')}`;
  return withMeridiem ? `${base} ${h! >= 12 ? 'PM' : 'AM'}` : base;
}

export function formatRange(p: Period): string {
  const sameHalf = (toMinutes(p.start) < 720) === (toMinutes(p.end) <= 720);
  return sameHalf
    ? `${formatTime(p.start)} – ${formatTime(p.end, true)}`
    : `${formatTime(p.start, true)} – ${formatTime(p.end, true)}`;
}

export function currentPeriod(date: Date): Period | null {
  const minutes = date.getHours() * 60 + date.getMinutes();
  return PERIODS.find((p) => minutes >= toMinutes(p.start) && minutes < toMinutes(p.end)) ?? null;
}

export function periodEnded(date: Date, p: Period): boolean {
  return date.getHours() * 60 + date.getMinutes() >= toMinutes(p.end);
}
