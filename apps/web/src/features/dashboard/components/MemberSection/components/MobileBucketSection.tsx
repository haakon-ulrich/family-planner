import { Moon, Sun, Sunrise } from 'lucide-react'
import TaskTile from '../../BucketRow/components/TaskTile'
import type { DashboardMember, DashboardTask } from '../../../types'

const BUCKET_META: Record<keyof DashboardMember['tasks'], { label: string; icon: React.ReactNode }> = {
  morgen: { label: 'Morgen', icon: <Sunrise className="w-4 h-4" /> },
  nachmittag: { label: 'Nachmittag', icon: <Sun className="w-4 h-4" /> },
  abend: { label: 'Abend', icon: <Moon className="w-4 h-4" /> },
}

interface MobileBucketSectionProps {
  bucket: keyof DashboardMember['tasks']
  tasks: DashboardTask[]
  memberId: string
  memberColor: string
}

const MobileBucketSection = ({ bucket, tasks, memberId, memberColor }: MobileBucketSectionProps) => {
  if (tasks.length === 0) return null
  const { label, icon } = BUCKET_META[bucket]

  return (
    <div className="border-t border-slate-700/40">
      <div className="flex items-center gap-2 px-4 py-2">
        <span className="text-slate-500">{icon}</span>
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{label}</span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 px-3 pb-3">
        {tasks.map((task) => (
          <TaskTile key={task.id} {...task} memberId={memberId} color={memberColor} />
        ))}
      </div>
    </div>
  )
}

export default MobileBucketSection
