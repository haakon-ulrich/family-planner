import TaskTile from './TaskTile';
import type { DashboardTask } from '../../../types';

interface BucketCellProps {
  icon: React.ReactNode;
  label: string;
  tasks: DashboardTask[];
  memberId: string;
  memberColor: string;
  hasBorderRight: boolean;
}

const BucketCell = ({
  icon,
  label,
  tasks,
  memberId,
  memberColor,
  hasBorderRight,
}: BucketCellProps) => (
  <div
    className={`flex-1 min-w-0 flex flex-col ${hasBorderRight ? 'border-r border-slate-700/60' : ''}`}
  >
    <div className="flex items-center gap-2 px-4 py-2">
      <span className="text-slate-500">{icon}</span>
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
        {label}
      </span>
    </div>
    <div className="flex flex-col gap-1.5 px-3 pb-3">
      {[...tasks]
        .sort((a, b) => {
          if (a.dueByTime && b.dueByTime) return a.dueByTime.localeCompare(b.dueByTime);
          if (a.dueByTime) return -1;
          if (b.dueByTime) return 1;
          return 0;
        })
        .map((task) => (
          <TaskTile key={task.id} {...task} memberId={memberId} color={memberColor} />
        ))}
    </div>
  </div>
);

export default BucketCell;
