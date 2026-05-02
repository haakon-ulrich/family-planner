import ProgressRing from '../MemberHeaderRow/components/ProgressRing'
import MobileBucketSection from './components/MobileBucketSection'
import { getCompletionProgress } from '../../utils'
import type { DashboardMember } from '../../types'

interface MemberSectionProps {
  member: DashboardMember
}

const MemberSection = ({ member }: MemberSectionProps) => {
  const progress = getCompletionProgress(member)
  const isComplete = progress >= 1

  return (
    <div className="border-b border-slate-700/50" style={{ borderLeftWidth: 3, borderLeftColor: member.color }}>
      {/* Compact member header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/40">
        <div className="relative w-12 h-12 shrink-0 flex items-center justify-center">
          <ProgressRing size={48} color={member.color} progress={progress} strokeWidth={4} complete={isComplete} />
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ backgroundColor: `${member.color}33`, color: member.color }}
          >
            {member.name.charAt(0).toUpperCase()}
          </div>
        </div>
        <span className="text-base font-semibold text-white">{member.name}</span>
        {member.streak > 0 && (
          <span className="ml-auto text-sm font-medium" style={{ color: member.color }}>
            🔥 {member.streak}
          </span>
        )}
      </div>

      <MobileBucketSection bucket="morgen" tasks={member.tasks.morgen} memberId={member.id} memberColor={member.color} />
      <MobileBucketSection bucket="nachmittag" tasks={member.tasks.nachmittag} memberId={member.id} memberColor={member.color} />
      <MobileBucketSection bucket="abend" tasks={member.tasks.abend} memberId={member.id} memberColor={member.color} />
    </div>
  )
}

export default MemberSection
