import { useState } from 'react';
import { Moon, Sun, Sunrise } from 'lucide-react';
import { addDays, parseISO } from 'date-fns';
import DashboardHeader from './DashboardHeader';
import CalendarColumn from './CalendarColumn';
import MemberHeaderRow from './MemberHeaderRow';
import BucketRow from './BucketRow';
import MemberSection from './MemberSection';
import { useMembers } from '@web/features/members';
import { useTasks } from '@web/features/tasks';
import { useInstances, useStepInstances } from '@web/features/instances';
import { useMemberStreaks } from '@web/features/streaks';
import { buildDashboardMembers } from '../utils';
import { DashboardDateProvider } from '../DashboardDate';
import type { DashboardMember } from '../types';

const todayString = () => new Date().toLocaleDateString('sv'); // YYYY-MM-DD in local time

const BUCKETS: Array<{ icon: React.ReactNode; label: string; key: keyof DashboardMember['tasks'] }> = [
  { icon: <Sunrise className="w-4 h-4" />, label: 'Morgen', key: 'morgen' },
  { icon: <Sun className="w-4 h-4" />, label: 'Nachmittag', key: 'nachmittag' },
  { icon: <Moon className="w-4 h-4" />, label: 'Abend', key: 'abend' },
];

const shiftDate = (date: string, days: number): string =>
  addDays(parseISO(date), days).toLocaleDateString('sv');

const Dashboard = () => {
  const [date, setDate] = useState(todayString);

  const { data: apiMembers = [] } = useMembers();
  const { data: tasks = [] } = useTasks({ active: true });
  const { data: instances = [] } = useInstances(date);
  const { data: stepInstances = [] } = useStepInstances(date);
  const streaks = useMemberStreaks(apiMembers.map((m) => m.id));

  const members = buildDashboardMembers(apiMembers, tasks, instances, stepInstances, date, streaks);

  return (
    <DashboardDateProvider date={date}>
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-slate-900 text-white">
        <DashboardHeader
          date={date}
          onPrev={() => setDate((d) => shiftDate(d, -1))}
          onNext={() => setDate((d) => shiftDate(d, +1))}
          onToday={() => setDate(todayString())}
        />

        {/* Desktop layout: member columns + calendar sidebar */}
        <main className="hidden lg:flex flex-1 min-h-0">
          <div className="flex-4 flex flex-col overflow-y-auto">
            <MemberHeaderRow members={members} />
            {BUCKETS.map(({ icon, label, key }) => (
              <BucketRow key={key} icon={icon} label={label} members={members} bucket={key} />
            ))}
          </div>
          <CalendarColumn />
        </main>

        {/* Mobile layout: members stacked, calendar at bottom */}
        <main className="lg:hidden flex-1 overflow-y-auto">
          {members.map((member) => (
            <MemberSection key={member.id} member={member} />
          ))}
          <CalendarColumn />
        </main>
      </div>
    </DashboardDateProvider>
  );
};

export default Dashboard;
