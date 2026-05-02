import { useEffect } from 'react'
import { motion, useAnimation } from 'framer-motion'

interface ProgressRingProps {
  size: number
  color: string
  progress: number // 0–1
  strokeWidth?: number
  complete?: boolean
}

const ProgressRing = ({ size, color, progress, strokeWidth = 6, complete = false }: ProgressRingProps) => {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(1, progress))
  const offset = circumference * (1 - clamped)
  const controls = useAnimation()

  useEffect(() => {
    if (complete) {
      controls.start(
        {
          filter: [
            `drop-shadow(0 0 2px ${color}70)`,
            `drop-shadow(0 0 10px ${color}ee)`,
            `drop-shadow(0 0 2px ${color}70)`,
          ],
        },
        { repeat: 3, duration: 1.8, ease: 'easeInOut' },
      )
    } else {
      controls.stop()
      controls.start({ filter: 'none' }, { duration: 0.3 })
    }
  }, [complete, color, controls])

  return (
    <motion.div className="absolute inset-0 -rotate-90" animate={controls}>
      <svg width={size} height={size} aria-hidden="true">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#334155"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc — always rendered so the CSS transition fires on the first completion */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={complete ? strokeWidth + 1.5 : strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease-in-out, stroke-width 0.3s ease' }}
        />
      </svg>
    </motion.div>
  )
}

export default ProgressRing
