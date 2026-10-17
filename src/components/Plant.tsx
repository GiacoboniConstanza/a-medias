export type PlantStage = 'lush' | 'steady' | 'wilted' | 'sprout'

const LABEL: Record<PlantStage, string> = {
  lush: 'Plantita frondosa: queda bastante del mes',
  steady: 'Plantita en buen estado: queda una parte del mes',
  wilted: 'Plantita mustia: queda poco del mes',
  sprout: 'Plantita recién brotada',
}

export function plantStage(percent: number, empty: boolean): PlantStage {
  if (empty) return 'sprout'
  if (percent >= 50) return 'lush'
  if (percent >= 25) return 'steady'
  return 'wilted'
}

export function Plant({ stage }: { stage: PlantStage }) {
  const wilted = stage === 'wilted'
  const sun = wilted ? '#DEC59E' : '#F4C542'
  const stem = wilted ? '#C4866D' : '#6A784D'
  return (
    <svg viewBox="0 0 120 120" className="h-[120px] w-[120px] shrink-0" role="img" aria-label={LABEL[stage]}>
      <circle cx="92" cy="26" r={stage === 'lush' ? 15 : 12} fill={sun} />
      <g stroke={sun} strokeWidth="3" strokeLinecap="round">
        <path d="M92 4v4M92 44v4M70 26h4M110 26h4M77 11l3 3M104 38l3 3M107 11l-3 3" />
      </g>
      {stage === 'lush' ? (
        <>
          <path d="M60 92 C60 70 58 58 56 44" stroke={stem} strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M57 60 C40 58 32 46 34 36 C48 36 58 46 57 60Z" fill="#C7DDAE" />
          <path d="M58 52 C72 48 80 36 78 26 C64 28 56 38 58 52Z" fill="#6A784D" />
          <path d="M59 74 C74 74 84 64 84 54 C70 54 60 62 59 74Z" fill="#C7DDAE" />
        </>
      ) : null}
      {stage === 'steady' ? (
        <>
          <path d="M60 92 C60 78 59 70 58 60" stroke={stem} strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M58 72 C42 70 36 60 38 52 C50 52 58 60 58 72Z" fill="#C7DDAE" />
          <path d="M59 64 C72 60 78 50 76 42 C64 44 58 52 59 64Z" fill="#6A784D" />
        </>
      ) : null}
      {stage === 'wilted' ? (
        <>
          <path d="M58 92 C64 78 78 76 82 86" stroke={stem} strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M80 84 C92 90 96 102 84 106 C74 100 70 90 80 84Z" fill="#C4866D" />
          <path d="M78 80 C90 74 100 78 98 90 C88 88 78 84 78 80Z" fill="#DEC59E" />
        </>
      ) : null}
      {stage === 'sprout' ? (
        <>
          <path d="M60 92 C60 84 59 80 58 74" stroke={stem} strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M58 76 C48 72 46 64 52 62 C58 68 60 74 58 76Z" fill="#C7DDAE" />
        </>
      ) : null}
      <path d="M36 90 h48 l-6 24 h-36z" fill="#C4866D" />
      <rect x="32" y="84" width="56" height="10" rx="5" fill="#DEC59E" />
    </svg>
  )
}
