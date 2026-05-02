import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import type { SingleStepTask } from '../../../types';
import { useDashboardDate } from '../../../DashboardDate';
import { useUpsertInstance, usePostponeInstance } from '@web/features/instances';
import { getTodayString, isDueTimeOverdue } from '@web/features/dashboard/utils';
import { playClick } from '@web/features/dashboard/sounds';
import useLongPress from '@web/hooks/useLongPress';
import PostponeModal from './PostponeModal';

type SingleStepTileProps = SingleStepTask & { color: string; memberId: string };

const SingleStepTile = ({ id, title, icon, status, color, dueByTime, postponable }: SingleStepTileProps) => {
  const date = useDashboardDate();
  const upsert = useUpsertInstance();
  const postpone = usePostponeInstance();
  const [showPostponeModal, setShowPostponeModal] = useState(false);

  const isCompleted = status === 'completed';
  const isToday = date === getTodayString();
  const overdue = !!dueByTime && isToday && isDueTimeOverdue(dueByTime);
  const canInteract = isCompleted ? isToday : isToday && !overdue;
  const canPostpone = postponable && isToday && !isCompleted;

  const handleToggle = () => {
    if (!canInteract) return;
    playClick();
    upsert.mutate({ taskId: id, date, status: isCompleted ? 'pending' : 'completed' });
  };

  const longPress = useLongPress(() => {
    if (canPostpone) setShowPostponeModal(true);
  });

  const handlePostponeConfirm = () => {
    setShowPostponeModal(false);
    postpone.mutate({ taskId: id, date });
  };

  const bgClass =
    overdue && !isCompleted
      ? 'bg-red-950/60'
      : isCompleted
        ? ''
        : 'bg-slate-800/70 hover:bg-slate-700/70';

  const dimmed = !isCompleted && !isToday;

  return (
    <>
    {showPostponeModal && (
      <PostponeModal
        taskTitle={title}
        onConfirm={handlePostponeConfirm}
        onCancel={() => setShowPostponeModal(false)}
      />
    )}
    <motion.div
      whileTap={canInteract ? { scale: 0.93 } : undefined}
      onClick={handleToggle}
      {...(canPostpone ? longPress : {})}
      className={`flex flex-col items-center pt-3 pb-2.5 rounded-2xl select-none ${canInteract ? 'cursor-pointer' : 'cursor-default'} ${bgClass} ${dimmed ? 'opacity-50' : ''}`}
      style={isCompleted ? { backgroundColor: `${color}18` } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <div className="relative w-14 h-14 flex items-center justify-center">
        <motion.span
          animate={{ opacity: isCompleted ? 0.25 : 1 }}
          transition={{ duration: 0.2 }}
          className="text-4xl leading-none"
        >
          {icon}
        </motion.span>
        <AnimatePresence>
          {isCompleted && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 22 }}
              className="absolute inset-0 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${color}B3` }}
            >
              <Check className="w-7 h-7 text-white" strokeWidth={2.5} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <motion.span
        animate={{ color: isCompleted ? '#64748b' : '#cbd5e1' }}
        transition={{ duration: 0.2 }}
        className="text-xs font-medium mt-1.5 text-center px-1 leading-tight"
      >
        {title}
      </motion.span>

      {dueByTime && !isCompleted && (
        <span className={`text-xs mt-0.5 ${overdue ? 'text-red-400' : 'text-amber-400/80'}`}>
          {dueByTime} Uhr
        </span>
      )}
    </motion.div>
    </>
  );
};

export default SingleStepTile;
