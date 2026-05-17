export type TaskStatus = 'pending' | 'completed' | 'skipped' | 'carried_over'

export interface TaskStep {
  id: string
  icon: string
  status: TaskStatus
}

interface DashboardTaskBase {
  id: string
  title: string
  dueByTime?: string
  postponable: boolean
}

export interface SingleStepTask extends DashboardTaskBase {
  kind: 'single'
  icon: string
  status: TaskStatus
}

export interface MultiStepTask extends DashboardTaskBase {
  kind: 'multi'
  steps: TaskStep[]
}

export type DashboardTask = SingleStepTask | MultiStepTask

export interface CalendarAppointment {
  id: string
  title: string
  startTime: string       // "HH:MM", or '' for all-day events
  endTime: string         // "HH:MM", or '' for all-day events
  allDay: boolean
  location: string | null
  memberColors: string[]  // hex, one per attending member
}

export interface DashboardMember {
  id: string
  name: string
  color: string // hex
  streak: number
  isSkipped: boolean
  tasks: {
    morgen: DashboardTask[]
    nachmittag: DashboardTask[]
    abend: DashboardTask[]
  }
}
