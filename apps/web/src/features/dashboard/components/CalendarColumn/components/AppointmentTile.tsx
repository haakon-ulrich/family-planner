import { MapPin } from 'lucide-react'
import type { CalendarAppointment } from '../../../types'

type AppointmentTileProps = CalendarAppointment

const AppointmentTile = ({ title, startTime, endTime, allDay, location, memberColors }: AppointmentTileProps) => (
  <div
    className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-slate-800/80"
    style={{ borderLeft: `3px solid ${memberColors[0]}` }}
  >
    <div className="flex flex-col min-w-0 flex-1">
      {allDay ? (
        <span className="text-xs text-slate-500 tabular-nums">Ganztägig</span>
      ) : (
        <span className="text-xs text-slate-400 tabular-nums">
          {startTime} – {endTime} Uhr
        </span>
      )}
      <span className="text-sm font-medium text-slate-200 mt-0.5 leading-snug">{title}</span>
      {location && (
        <span className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
          <MapPin className="w-3 h-3 shrink-0" />
          {location}
        </span>
      )}
    </div>
    <div className="flex gap-1 mt-1 shrink-0">
      {memberColors.map((color, i) => (
        <div key={i} className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      ))}
    </div>
  </div>
)

export default AppointmentTile
