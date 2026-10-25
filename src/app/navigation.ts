import {
  ArrowLeftRight,
  CalendarCheck,
  ChartColumn,
  FileText,
  GraduationCap,
  House,
  LibraryBig,
  Receipt,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  /** Small secondary label shown beside the item, e.g. "Classwise". */
  tag?: string;
  /** What the page will eventually do; shown on its placeholder screen. */
  description: string;
}

/** Planned primary navigation, in display order. Only Home is built in Stage 1. */
export const navItems: NavItem[] = [
  { path: '/', label: 'Home', icon: House, description: 'Your day at a glance.' },
  {
    path: '/entries',
    label: 'Entries',
    icon: ArrowLeftRight,
    tag: 'Classwise',
    description:
      'A single workflow for issuing and returning books for a student, organised class by class.',
  },
  {
    path: '/students',
    label: 'Students',
    icon: GraduationCap,
    description: 'Student directory, classes and sections, profiles and loan history.',
  },
  {
    path: '/collections',
    label: 'Collections',
    icon: LibraryBig,
    description: 'Junior and Senior library catalogues, individual copies, accession numbers and shelf locations.',
  },
  {
    path: '/attendance',
    label: 'Attendance',
    icon: CalendarCheck,
    description: 'Library attendance records, review and discrepancy handling.',
  },
  {
    path: '/stats',
    label: 'Stats',
    icon: ChartColumn,
    description: 'Circulation and usage statistics.',
  },
  {
    path: '/fines',
    label: 'Fines',
    icon: Receipt,
    description: 'Fine assessment, payments and adjustments.',
  },
  {
    path: '/reports',
    label: 'Reports',
    icon: FileText,
    description: 'Printable and exportable reports.',
  },
];
