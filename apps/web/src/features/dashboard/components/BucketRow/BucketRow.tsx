import BucketCell from './components/BucketCell'
import type { DashboardMember } from '../../types'

interface BucketRowProps {
  icon: React.ReactNode
  label: string
  members: DashboardMember[]
  bucket: keyof DashboardMember['tasks']
}

const BucketRow = ({ icon, label, members, bucket }: BucketRowProps) => (
  <div className="flex flex-none border-t border-slate-700/50">
    {members.map((member, i) => (
      <BucketCell
        key={member.id}
        icon={icon}
        label={label}
        tasks={member.tasks[bucket]}
        memberId={member.id}
        memberColor={member.color}
        hasBorderRight={i < members.length - 1}
      />
    ))}
  </div>
)

export default BucketRow
