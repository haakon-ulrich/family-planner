import type { LucideProps } from 'lucide-react'

interface WeatherDayProps {
  label: string
  Icon: React.ComponentType<LucideProps>
  iconClass: string
  high: number
}

const WeatherDay = ({ label, Icon, iconClass, high }: WeatherDayProps) => (
  <div className="flex flex-col items-center gap-1.5">
    <span className="text-xs font-medium text-slate-500">{label}</span>
    <Icon className={`w-5 h-5 ${iconClass}`} strokeWidth={1.5} />
    <span className="text-xs font-semibold text-slate-300">{high}°</span>
  </div>
)

export default WeatherDay
