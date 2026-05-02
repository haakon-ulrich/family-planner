import AppointmentTile from './AppointmentTile'
import type { CalendarAppointment } from '../../../types'

interface CalendarSectionProps {
  title: string
  appointments: CalendarAppointment[]
}

const CalendarSection = ({ title, appointments }: CalendarSectionProps) => (
  <section>
    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
      {title}
    </h3>
    {appointments.length === 0 ? (
      <div className="min-h-12 rounded-lg border border-slate-700 border-dashed" />
    ) : (
      <div className="flex flex-col gap-2">
        {appointments.map((appt) => (
          <AppointmentTile key={appt.id} {...appt} />
        ))}
      </div>
    )}
  </section>
)

export default CalendarSection
