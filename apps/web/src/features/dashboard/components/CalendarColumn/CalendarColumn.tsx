import { Calendar, RefreshCw } from 'lucide-react'
import { addDays, parseISO } from 'date-fns'
import CalendarSection from './components/CalendarSection'
import WeatherSection from './components/WeatherSection'
import VacuumWidget from './components/VacuumWidget'
import MediaWidget from './components/MediaWidget'
import { VacuumControls } from '@web/features/vacuum'
import { useDashboardDate } from '../../DashboardDate'
import { useCalendarEvents } from '@web/features/calendar'
import { useMembers } from '@web/features/members'
import type { CalendarAppointment } from '../../types'
import type { CalendarEvent } from '@web/features/calendar'
import { useRefreshCalendar } from '@web/features/calendar/hooks'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const todayString = () => new Date().toLocaleDateString('sv')

const shiftDate = (date: string, days: number): string =>
  addDays(parseISO(date), days).toLocaleDateString('sv')

const extractTime = (iso: string): string => {
  const match = iso.match(/T(\d{2}:\d{2})/)
  return match ? match[1] : ''
}

const extractDatePart = (iso: string): string =>
  iso.slice(0, 10)

const sectionLabel = (date: string): string => {
  const today = todayString()
  const diff = Math.round(
    (parseISO(date).getTime() - parseISO(today).getTime()) / 86_400_000
  )
  if (diff === 0) return 'Heute'
  if (diff === 1) return 'Morgen'
  if (diff === -1) return 'Gestern'
  return parseISO(date).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'short' })
}

const toAppointment = (
  event: CalendarEvent,
  memberColorByName: Map<string, string>,
): CalendarAppointment => {
  const colors: string[] = event.memberHint
    ? [memberColorByName.get(event.memberHint) ?? '#64748b']
    : ['#64748b']

  return {
    id: event.id,
    title: event.title,
    startTime: event.allDay ? '' : extractTime(event.start),
    endTime: event.allDay ? '' : extractTime(event.end),
    allDay: event.allDay,
    location: event.location,
    memberColors: colors,
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const DAYS_SHOWN = 3

const CalendarColumn = () => {
  const date = useDashboardDate()
  const start = date
  const end = shiftDate(date, DAYS_SHOWN) // exclusive upper bound — lt(event.start, end)

  const { data: events = [] } = useCalendarEvents(start, end)
  const { data: members = [] } = useMembers()

  const memberColorByName = new Map(
    members.map((m) => [m.name.toLowerCase(), m.color])
  )

  // Group events by their date
  const days = Array.from({ length: DAYS_SHOWN }, (_, i) => shiftDate(date, i))

  const eventsByDate = new Map<string, CalendarAppointment[]>()
  for (const day of days) eventsByDate.set(day, [])

  for (const event of events) {
    const day = extractDatePart(event.start)
    if (eventsByDate.has(day)) {
      eventsByDate.get(day)!.push(toAppointment(event, memberColorByName))
    }
  }

  return (
    <div className="flex flex-col bg-slate-800/50 border-t border-slate-700/60 lg:flex-[1.3] lg:border-t-0 lg:border-l min-w-0 lg:overflow-y-auto">
      <MediaWidget />
      <WeatherSection />

      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
        <div className='flex items-center gap-2.5'>

        <Calendar className="w-5 h-5 text-slate-500" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
          Kalender
        </span>
        </div>
        <button onClick={useRefreshCalendar()}>
          <RefreshCw className="w-5 h-5 text-slate-500 hover:text-white transition-colors" />
        </button>
      </div>

      <div className="flex flex-col gap-6 p-5">
        {days.map((day) => (
          <CalendarSection
            key={day}
            title={sectionLabel(day)}
            appointments={eventsByDate.get(day) ?? []}
          />
        ))}
      </div>

      <VacuumWidget />
      <VacuumControls />
    </div>
  )
}

export default CalendarColumn
