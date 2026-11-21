import {
  Activity, ArrowLeftRight, Coins, Atom, Bug, BookOpen, Biohazard, Boxes, Cable, CalendarDays, ClipboardList, Cpu, Dna, Droplets, Eye, FileText,
  FlaskConical, Flame, Gauge, Glasses, Hammer, HeartPulse, Leaf, Lightbulb, Magnet, Microscope, NotebookPen, Package, Pill, Radiation,
  Ruler, Scale, ShieldCheck, ShoppingCart, Siren, Sprout, Syringe, Telescope, TestTube, Thermometer, Trash2, Wrench, Zap, type LucideIcon,
} from 'lucide-react';

export const ICONS: Record<string, LucideIcon> = {
  atom: Atom, flask: FlaskConical, leaf: Leaf, beaker: TestTube, microscope: Microscope, zap: Zap, magnet: Magnet, shield: ShieldCheck,
  package: Package, wrench: Wrench, book: BookOpen, gauge: Gauge, dna: Dna, clipboard: ClipboardList, siren: Siren, droplets: Droplets,
  hammer: Hammer, trash: Trash2, swap: ArrowLeftRight, cart: ShoppingCart, calendar: CalendarDays, notebook: NotebookPen,
  thermometer: Thermometer, flame: Flame, bug: Bug, lightbulb: Lightbulb, cpu: Cpu, telescope: Telescope, sprout: Sprout, scale: Scale,
  ruler: Ruler, biohazard: Biohazard, radiation: Radiation, glasses: Glasses, heart: HeartPulse, cable: Cable, file: FileText,
  coins: Coins, boxes: Boxes, pill: Pill, syringe: Syringe, eye: Eye, activity: Activity,
};

export function Icon({ name, className = 'h-4 w-4', style }: { name?: string; className?: string; style?: React.CSSProperties }) {
  const C = (name && ICONS[name]) || Package;
  return <C className={className} style={style} aria-hidden />;
}
