import { useEffect, useRef, useState } from 'react';
import { useAnimate } from 'framer-motion';
import { Flame } from 'lucide-react';
import ProgressRing from './ProgressRing';
import CompletionBurst from './CompletionBurst';
import CompletionMessage from './CompletionMessage';
import { getCompletionProgress, getTodayString } from '../../../utils';
import { playFanfare } from '../../../sounds';
import { useDashboardDate } from '../../../DashboardDate';
import type { DashboardMember } from '../../../types';

interface MemberAvatarProps {
  member: DashboardMember;
}

const MemberAvatar = ({ member }: MemberAvatarProps) => {
  const progress = getCompletionProgress(member);
  const isComplete = progress >= 1;
  const date = useDashboardDate();
  const [burstKey, setBurstKey] = useState(0);
  const [msgKey, setMsgKey] = useState(0);
  const prevCompleteRef = useRef(isComplete);
  const prevDateRef = useRef(date);
  const [scope, animate] = useAnimate();

  useEffect(() => {
    if (date !== prevDateRef.current) {
      prevDateRef.current = date;
      prevCompleteRef.current = isComplete;
      return;
    }
    if (isComplete && !prevCompleteRef.current && date === getTodayString()) {
      animate(scope.current, { scale: [1, 1.15, 0.92, 1.08, 1] }, { duration: 0.55 });
      setBurstKey((k) => k + 1);
      setMsgKey((k) => k + 1);
      playFanfare();
    }
    prevCompleteRef.current = isComplete;
  }, [isComplete, date, animate, scope]);

  if (member.isSkipped) {
    return (
      <div className="relative w-24 h-24 flex items-center justify-center">
        <ProgressRing size={96} color={member.color} progress={0} complete={false} />
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ backgroundColor: `${member.color}20` }}
        >
          <span className="text-3xl">✈️</span>
        </div>
      </div>
    );
  }

  return (
    <div ref={scope} className="relative w-24 h-24 flex items-center justify-center">
      {burstKey > 0 && <CompletionBurst key={burstKey} color={member.color} />}
      {msgKey > 0 && <CompletionMessage key={msgKey} color={member.color} />}
      <ProgressRing size={96} color={member.color} progress={progress} complete={isComplete} />
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center transition-colors duration-500"
        style={{ backgroundColor: isComplete ? `${member.color}55` : `${member.color}28` }}
      >
        {member.streak > 0 ? (
          <div className="relative flex items-center justify-center">
            <Flame
              className="w-11 h-11"
              style={{
                color: member.color,
                fill: isComplete ? member.color : 'none',
                strokeWidth: 1.5,
                opacity: isComplete ? 1 : 0.6,
                transition: 'fill 0.35s ease, opacity 0.35s ease',
              }}
            />
            <span
              className="absolute text-xl font-bold text-white leading-none tabular-nums mt-2"
              style={{
                textShadow: '0 1px 4px rgba(0,0,0,0.6)',
                opacity: isComplete ? 1 : 0.85,
              }}
            >
              {member.streak}
            </span>
          </div>
        ) : (
          <span className="text-2xl font-bold" style={{ color: member.color }}>
            {member.name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
    </div>
  );
};

export default MemberAvatar;
