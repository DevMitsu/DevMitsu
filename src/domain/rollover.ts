import type { Student } from './types';

export interface YearPlan {
  label: string;
  startsOn: string;
  endsOn: string;
  /** Section letters for each class next year. */
  sections: Record<number, string[]>;
  /** Re-deal the class evenly across its sections instead of keeping each student's section. */
  shuffle: Record<number, boolean>;
  clearTimetable: boolean;
}

function mulberry(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seedOf = (text: string) => [...text].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);

export interface RolloverResult {
  students: Student[];
  /** Planned head-count: counts[grade][section]. */
  counts: Record<number, Record<string, number>>;
  left: number;
  movedUp: number;
}

/** Works out next year's classes. Pure, so the same code gives the preview and the result. */
export function computeRollover(students: Student[], plan: YearPlan): RolloverResult {
  const rand = mulberry(seedOf(plan.label));
  const byGrade = new Map<number, Student[]>();
  const out: Student[] = [];
  let left = 0;

  for (const s of students) {
    if (!s.active) { out.push(s); continue; }
    if (s.grade >= 12) { left++; out.push({ ...s, active: false }); continue; }
    const next = { ...s, grade: s.grade + 1 };
    byGrade.set(next.grade, [...(byGrade.get(next.grade) ?? []), next]);
  }

  const counts: RolloverResult['counts'] = {};
  let movedUp = 0;
  for (const [grade, list] of byGrade) {
    const secs = plan.sections[grade]?.length ? plan.sections[grade]! : ['A'];
    const tally = Object.fromEntries(secs.map((x) => [x, 0]));
    let placed: Student[];
    if (plan.shuffle[grade]) {
      const order = [...list];
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j]!, order[i]!]; }
      placed = order.map((s, i) => ({ ...s, section: secs[i % secs.length]! }));
    } else {
      placed = list.map((s) => {
        if (secs.includes(s.section)) return s;
        const emptiest = secs.reduce((a, b) => (tally[a]! <= tally[b]! ? a : b));
        return { ...s, section: emptiest };
      });
    }
    placed.forEach((s) => { tally[s.section] = (tally[s.section] ?? 0) + 1; });
    counts[grade] = tally;
    movedUp += placed.length;
    out.push(...placed);
  }
  return { students: out, counts, left, movedUp };
}
