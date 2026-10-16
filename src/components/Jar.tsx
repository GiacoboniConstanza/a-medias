import type { JarTone } from '../lib/jar.ts'

const FILL: Record<JarTone, string> = {
  green: '#8fe3b0',
  yellow: '#ffd36e',
  red: '#ffb4b4',
  empty: '#e4dcf8',
}

const INK: Record<JarTone, string> = {
  green: '#2f7a4f',
  yellow: '#8a6a12',
  red: '#c0392b',
  empty: '#8a82a6',
}

export function Jar({ percent, tone }: { percent: number; tone: JarTone }) {
  const clamped = Math.max(0, Math.min(100, percent))
  const surface = 214 - (clamped / 100) * 168
  return (
    <svg viewBox="0 0 350 250" className="mx-auto block w-full max-w-[350px]" role="img" aria-label={`Te queda el ${clamped} por ciento`}>
      <rect x="135" y="8" width="80" height="22" rx="8" fill="#c9b8ff" />
      <clipPath id="jar-clip">
        <path d="M115 34 h120 q30 0 30 34 v150 q0 34 -34 34 h-112 q-34 0 -34 -34 v-150 q0 -34 30 -34z" />
      </clipPath>
      <path d="M115 34 h120 q30 0 30 34 v150 q0 34 -34 34 h-112 q-34 0 -34 -34 v-150 q0 -34 30 -34z" fill="#f4f0ff" stroke="#c9b8ff" strokeWidth="4" />
      <g clipPath="url(#jar-clip)">
        <path d={`M70 ${surface} q35 -14 70 0 t70 0 t70 0 t70 0 v220 h-280z`} fill={FILL[tone]} />
      </g>
      <text x="175" y="168" textAnchor="middle" fontSize="30" fontWeight="900" fill={INK[tone]}>
        {tone === 'empty' ? '—' : `${clamped}%`}
      </text>
      <text x="175" y="190" textAnchor="middle" fontSize="13" fontWeight="700" fill={INK[tone]}>
        te queda
      </text>
    </svg>
  )
}
