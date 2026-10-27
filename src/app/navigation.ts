import {
  ArrowLeftRight, CalendarCheck, ChartColumn, FileText, GraduationCap, House, Inbox, LibraryBig, Receipt, SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  tag?: string;
  /** Other path prefixes that should light up this item. */
  also?: string[];
  badge?: 'pending';
}

export const navItems: NavItem[] = [
  { path: '/', label: 'Home', icon: House },
  { path: '/entries', label: 'Entries', icon: ArrowLeftRight, tag: 'Classwise', also: ['/class/'] },
  { path: '/students', label: 'Students', icon: GraduationCap, also: ['/student/', '/teacher/'] },
  { path: '/collections', label: 'Collections', icon: LibraryBig },
  { path: '/attendance', label: 'Attendance', icon: CalendarCheck },
  { path: '/stats', label: 'Stats', icon: ChartColumn },
  { path: '/fines', label: 'Fines', icon: Receipt },
  { path: '/reports', label: 'Reports', icon: FileText },
  { path: '/pending', label: 'Pending', icon: Inbox, badge: 'pending' },
  { path: '/misc', label: 'Miscellaneous', icon: SlidersHorizontal },
];

export function isNavActive(item: NavItem, pathname: string): boolean {
  if (item.path === '/') return pathname === '/';
  return pathname === item.path || pathname.startsWith(item.path + '/') || !!item.also?.some((p) => pathname.startsWith(p));
}
