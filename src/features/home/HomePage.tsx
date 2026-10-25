import { usePageTitle } from '../../lib/usePageTitle';
import { useNow } from '../../lib/useNow';
import { TimetablePanel } from '../timetable/TimetablePanel';
import { useTimetable } from '../timetable/useTimetable';
import { resolveDisplayDay, slotKey } from '../timetable/utils';
import { GreetingHeader } from './GreetingHeader';
import { TodaySummary } from './TodaySummary';

export function HomePage() {
  usePageTitle();
  const now = useNow();
  const { state, saving, reload, setAssignment } = useTimetable();

  const scheduledClasses =
    state.status === 'ready'
      ? (() => {
          const { day } = resolveDisplayDay(now, state.data.days);
          return state.data.periods.filter(
            (p) => p.kind === 'teaching' && state.data.assignments[slotKey(day, p.id)],
          ).length;
        })()
      : null;

  return (
    <div className="space-y-6">
      <GreetingHeader />
      <TimetablePanel state={state} saving={saving} onSave={setAssignment} onRetry={reload} />
      <TodaySummary scheduledClasses={scheduledClasses} />
    </div>
  );
}
