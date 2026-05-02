import { useState } from 'react';
import StepIcon from './StepIcon';
import PostponeModal from './PostponeModal';
import type { MultiStepTask } from '../../../types';
import { useDashboardDate } from '../../../DashboardDate';
import { getTodayString, isDueTimeOverdue } from '@web/features/dashboard/utils';
import { usePostponeInstance } from '@web/features/instances';
import useLongPress from '@web/hooks/useLongPress';

type MultiStepTileProps = MultiStepTask & { color: string; memberId: string };

const MultiStepTile = ({ id, title, steps, color, dueByTime, postponable }: MultiStepTileProps) => {
  const date = useDashboardDate();
  const postpone = usePostponeInstance();
  const [showPostponeModal, setShowPostponeModal] = useState(false);
  const allDone = steps.every((s) => s.status === 'completed');

  const isToday = date === getTodayString();
  const overdue = !!dueByTime && isToday && isDueTimeOverdue(dueByTime);
  const canPostpone = postponable && isToday && !allDone;

  const longPress = useLongPress(() => {
    if (canPostpone) setShowPostponeModal(true);
  });

  const handlePostponeConfirm = () => {
    setShowPostponeModal(false);
    postpone.mutate({ taskId: id, date });
  };

  const bgClass = overdue && !allDone ? 'bg-red-950/60' : allDone ? '' : 'bg-slate-800/70';
  const dimmed = !allDone && !isToday;

  return (
    <>
      {showPostponeModal && (
        <PostponeModal
          taskTitle={title}
          onConfirm={handlePostponeConfirm}
          onCancel={() => setShowPostponeModal(false)}
        />
      )}
      <div
        {...(canPostpone ? longPress : {})}
        className={`flex flex-col items-center pt-3 pb-2.5 px-2 rounded-2xl select-none transition-colors duration-300 ${bgClass} ${dimmed ? 'opacity-50' : ''}`}
        style={allDone ? { backgroundColor: `${color}18` } : undefined}
      >
        <div className="flex flex-wrap gap-4 mb-2 justify-center">
          {steps.map((step) => (
            <StepIcon key={step.id} step={step} color={color} isToday={isToday} overdue={overdue} />
          ))}
        </div>
        <span
          className={`font-medium mt-1.5 text-center px-1 leading-tight transition-colors duration-200 ${
            allDone ? 'text-slate-500' : 'text-slate-300'
          }`}
        >
          {title}
        </span>
        {dueByTime && !allDone && (
          <span className={`text-xs mt-0.5 ${overdue ? 'text-red-400' : 'text-amber-400/80'}`}>
            {dueByTime} Uhr
          </span>
        )}
      </div>
    </>
  );
};

export default MultiStepTile;
