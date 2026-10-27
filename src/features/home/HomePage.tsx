import { usePageTitle } from '../../lib/usePageTitle';
import { TimetablePanel } from '../timetable/TimetablePanel';
import { GreetingHeader } from './GreetingHeader';
import { PendingPanel } from './PendingPanel';
import { TodaySummary } from './TodaySummary';

export function HomePage() {
  usePageTitle();
  return (
    <div className="space-y-6">
      <GreetingHeader />
      <TimetablePanel />
      <TodaySummary />
      <PendingPanel />
    </div>
  );
}
