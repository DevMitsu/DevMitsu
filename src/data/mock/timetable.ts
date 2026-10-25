/**
 * MOCK DATA: an illustrative library-period schedule used only by the Stage 1 prototype.
 * It does not reflect any school's real timetable.
 */
import type { ClassGroup, TimetableData } from '../../features/timetable/types';

export const mockClasses: ClassGroup[] = [6, 7, 8, 9, 10, 11, 12].map((n) => ({
  id: `class-${n}`,
  name: `Class ${n}`,
  sections: ['A', 'B', 'C'],
}));

export const mockTimetable: TimetableData = {
  days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
  periods: [
    { id: 'p1', label: 'Period 1', start: '08:30', end: '09:10', kind: 'teaching' },
    { id: 'p2', label: 'Period 2', start: '09:10', end: '09:50', kind: 'teaching' },
    { id: 'p3', label: 'Period 3', start: '09:50', end: '10:30', kind: 'teaching' },
    { id: 'b1', label: 'Short break', start: '10:30', end: '10:50', kind: 'break' },
    { id: 'p4', label: 'Period 4', start: '10:50', end: '11:30', kind: 'teaching' },
    { id: 'p5', label: 'Period 5', start: '11:30', end: '12:10', kind: 'teaching' },
    { id: 'b2', label: 'Lunch', start: '12:10', end: '12:50', kind: 'break' },
    { id: 'p6', label: 'Period 6', start: '12:50', end: '13:30', kind: 'teaching' },
    { id: 'p7', label: 'Period 7', start: '13:30', end: '14:10', kind: 'teaching' },
  ],
  assignments: {
    'mon:p1': { classId: 'class-6', section: 'A' },
    'mon:p3': { classId: 'class-7', section: 'B' },
    'mon:p4': { classId: 'class-9', section: 'A' },
    'mon:p6': { classId: 'class-8', section: 'C' },
    'tue:p2': { classId: 'class-10', section: 'B' },
    'tue:p3': { classId: 'class-6', section: 'C' },
    'tue:p5': { classId: 'class-11', section: 'A' },
    'tue:p7': { classId: 'class-7', section: 'A' },
    'wed:p1': { classId: 'class-8', section: 'A' },
    'wed:p4': { classId: 'class-12', section: 'B' },
    'wed:p5': { classId: 'class-9', section: 'C' },
    'thu:p2': { classId: 'class-6', section: 'B' },
    'thu:p3': { classId: 'class-10', section: 'A' },
    'thu:p6': { classId: 'class-7', section: 'C' },
    'fri:p1': { classId: 'class-11', section: 'B' },
    'fri:p4': { classId: 'class-8', section: 'B' },
    'fri:p5': { classId: 'class-12', section: 'A' },
    'fri:p7': { classId: 'class-9', section: 'B' },
    'sat:p1': { classId: 'class-10', section: 'C' },
    'sat:p3': { classId: 'class-7', section: 'A' },
  },
};
