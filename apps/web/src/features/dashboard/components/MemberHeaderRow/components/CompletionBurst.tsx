import { motion } from 'framer-motion'

interface ParticleDef {
  angle: number
  radius: number
  size: number
  color: string
  delay: number
}

const makeParticles = (memberColor: string): ParticleDef[] => [
  ...Array.from({ length: 100 }, (_, i): ParticleDef => ({
    angle: i * 45,
    radius: 36 + (i % 2) * 8,
    size: 8 + (i % 2) * 2,
    color: [memberColor, '#fbbf24', '#fff', memberColor, '#fbbf24', '#fff', memberColor, '#fbbf24'][i],
    delay: i * 0.022,
  })),
  ...Array.from({ length: 100 }, (_, i): ParticleDef => ({
    angle: i * 45 + 22.5,
    radius: 52 + (i % 3) * 5,
    size: 8 + (i % 2) * 2,
    color: [memberColor, '#fbbf24', '#fff'][i % 3],
    delay: 0.045 + i * 0.018,
  })),
]

interface CompletionBurstProps {
  color: string
}

const CompletionBurst = ({ color }: CompletionBurstProps) => (
  <>
    {makeParticles(color).map((p, i) => {
      const rad = (p.angle * Math.PI) / 180
      return (
        <motion.div
          key={i}
          initial={{ x: 0, y: 0, scale: 0.3, opacity: 1 }}
          animate={{
            x: Math.cos(rad) * p.radius,
            y: Math.sin(rad) * p.radius,
            scale: 1.3,
            opacity: 0,
          }}
          transition={{ duration: 0.65, delay: p.delay, ease: [0.15, 0, 0.45, 1] }}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: p.size,
            height: p.size,
            marginTop: -(p.size / 2),
            marginLeft: -(p.size / 2),
            borderRadius: '50%',
            backgroundColor: p.color,
            pointerEvents: 'none',
          }}
        />
      )
    })}
  </>
)

export default CompletionBurst
