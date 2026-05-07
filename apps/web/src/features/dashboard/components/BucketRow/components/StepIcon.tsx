import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import type { TaskStep } from '../../../types';
import { useDashboardDate } from '../../../DashboardDate';
import { useUpsertStepInstance } from '@web/features/instances';
import { playClick } from '@web/features/dashboard/sounds';
import useLongPress from '@web/hooks/useLongPress';

interface StepIconProps {
  step: TaskStep;
  color: string;
  isToday: boolean;
  overdue: boolean;
}

const StepIcon = ({ step, color, isToday, overdue }: StepIconProps) => {
  const date = useDashboardDate();
  const upsert = useUpsertStepInstance();
  const done = step.status === 'completed';
  const canInteract = !done && isToday && !overdue;
  const canUncomplete = done && isToday;

  const { handlers: longPressHandlers, consumeFired } = useLongPress(() => {
    if (canUncomplete) {
      playClick();
      upsert.mutate({ taskStepId: step.id, date, status: 'pending' });
    }
  });

  const handleToggle = () => {
    if (consumeFired()) return;
    if (!canInteract) return;
    playClick();
    upsert.mutate({ taskStepId: step.id, date, status: 'completed' });
  };

  return (
    <motion.div
      whileTap={canInteract ? { scale: 0.8 } : undefined}
      onClick={handleToggle}
      {...(canUncomplete ? longPressHandlers : {})}
      className={`relative w-12 h-12 flex items-center justify-center ${canInteract ? 'cursor-pointer' : 'cursor-default'}`}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
    >
      <motion.span
        animate={{ opacity: done ? 0.25 : 1 }}
        transition={{ duration: 0.2 }}
        className="text-3xl leading-none"
      >
        {step.icon}
      </motion.span>
      <AnimatePresence>
        {done && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            className="absolute inset-0 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${color}B3` }}
          >
            <Check className="w-5 h-5 text-white" strokeWidth={2.5} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default StepIcon;
