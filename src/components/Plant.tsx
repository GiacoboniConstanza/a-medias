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

/** 0 semilla, menos de 25 brote, menos de 75 mediana, desde 75 planta grande. */
export type PotStage = 'seed' | 'sprout' | 'medium' | 'grown'

export type PotVariant = 'fondo' | 'gustos'

const POT_LABEL: Record<PotStage, string> = {
  seed: 'Semilla en maceta',
  sprout: 'Brote en maceta',
  medium: 'Planta mediana en maceta',
  grown: 'Planta grande con hojas en maceta',
}

export function potStage(percent: number): PotStage {
  if (!Number.isFinite(percent) || percent <= 0) return 'seed'
  const value = Math.min(percent, 100)
  if (value < 25) return 'sprout'
  if (value < 75) return 'medium'
  return 'grown'
}

export function Plant({ stage }: { stage: PlantStage }) {
  const wilted = stage === 'wilted'
  const sun = wilted ? 'var(--color-warn-soft)' : 'var(--color-warn)'
  const stem = wilted ? 'var(--color-alert)' : 'var(--color-good)'
  return (
    <svg viewBox="0 0 120 120" className="h-[120px] w-[120px] shrink-0" role="img" aria-label={LABEL[stage]}>
      <circle cx="92" cy="26" r={stage === 'lush' ? 15 : 12} fill={sun} />
      <g stroke={sun} strokeWidth="3" strokeLinecap="round">
        <path d="M92 4v4M92 44v4M70 26h4M110 26h4M77 11l3 3M104 38l3 3M107 11l-3 3" />
      </g>
      {stage === 'lush' ? (
        <>
          <path d="M60 92 C60 70 58 58 56 44" stroke={stem} strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M57 60 C40 58 32 46 34 36 C48 36 58 46 57 60Z" fill="var(--color-sage-light)" />
          <path d="M58 52 C72 48 80 36 78 26 C64 28 56 38 58 52Z" fill="var(--color-good)" />
          <path d="M59 74 C74 74 84 64 84 54 C70 54 60 62 59 74Z" fill="var(--color-sage-light)" />
        </>
      ) : null}
      {stage === 'steady' ? (
        <>
          <path d="M60 92 C60 78 59 70 58 60" stroke={stem} strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M58 72 C42 70 36 60 38 52 C50 52 58 60 58 72Z" fill="var(--color-sage-light)" />
          <path d="M59 64 C72 60 78 50 76 42 C64 44 58 52 59 64Z" fill="var(--color-good)" />
        </>
      ) : null}
      {stage === 'wilted' ? (
        <>
          <path d="M58 92 C64 78 78 76 82 86" stroke={stem} strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M80 84 C92 90 96 102 84 106 C74 100 70 90 80 84Z" fill="var(--color-alert)" />
          <path d="M78 80 C90 74 100 78 98 90 C88 88 78 84 78 80Z" fill="var(--color-warn-soft)" />
        </>
      ) : null}
      {stage === 'sprout' ? (
        <>
          <path d="M60 92 C60 84 59 80 58 74" stroke={stem} strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M58 76 C48 72 46 64 52 62 C58 68 60 74 58 76Z" fill="var(--color-sage-light)" />
        </>
      ) : null}
      <path d="M36 90 h48 l-6 24 h-36z" fill="var(--color-alert)" />
      <rect x="32" y="84" width="56" height="10" rx="5" fill="var(--color-warn-soft)" />
    </svg>
  )
}

function CopperPot() {
  return (
    <>
      <path d="M28 84 h36 l-5 18 h-26z" fill="var(--color-alert)" />
      <rect x="25" y="78" width="42" height="8" rx="4" fill="var(--color-warn-soft)" />
    </>
  )
}

export function PotPlant({
  variant,
  progress,
  className = '',
}: {
  variant: PotVariant
  progress: number
  className?: string
}) {
  if (variant === 'gustos') {
    return (
      <svg viewBox="0 0 58 58" className={className} role="img" aria-label="Plantita de gustos con flores">
        <circle cx="29" cy="29" r="29" fill="var(--color-copper-soft)" />
        <path d="M29 44 C29 36 29 30 28 22" stroke="var(--color-good)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d="M29 38 C22 38 18 33 19 28 C25 28 29 32 29 38Z" fill="var(--color-sage-light)" />
        <path d="M29 33 C35 32 39 27 38 22 C32 23 28.6 27 29 33Z" fill="var(--color-good)" />
        <g fill="var(--color-alert)">
          <circle cx="28" cy="13" r="4" />
          <circle cx="33" cy="17" r="4" />
          <circle cx="31" cy="22" r="4" />
          <circle cx="25" cy="22" r="4" />
          <circle cx="23" cy="17" r="4" />
        </g>
        <circle cx="28" cy="18" r="2.6" fill="var(--color-warn)" />
        <path d="M21 44 h16 l-2.5 8 h-11z" fill="var(--color-alert)" />
        <rect x="19.5" y="42" width="19" height="4.5" rx="2.2" fill="var(--color-warn-soft)" />
      </svg>
    )
  }

  const stage = potStage(progress)
  return (
    <svg viewBox="0 0 92 104" className={className} role="img" aria-label={POT_LABEL[stage]}>
      {stage === 'grown' ? (
        <>
          <path d="M46 78 C46 64 46 30 46 20" stroke="var(--color-good)" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M46 70 C36 70 30 63 31 56 C40 56 46 62 46 70Z" fill="var(--color-sage-light)" />
          <path d="M46 59 C56 58 62 51 61 44 C52 45 45.5 51 46 59Z" fill="var(--color-good)" />
          <path d="M46 48 C36 48 30 41 31 34 C40 34 46 40 46 48Z" fill="var(--color-sage-light)" />
          <path d="M46 37 C56 36 62 29 61 22 C52 23 45.5 29 46 37Z" fill="var(--color-good)" />
          <circle cx="46" cy="17" r="5.5" fill="var(--color-warn)" />
          <circle cx="46" cy="17" r="2.2" fill="var(--color-warn-strong)" />
        </>
      ) : null}
      {stage === 'medium' ? (
        <>
          <path d="M46 78 C46 64 46 63 46 53" stroke="var(--color-good)" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M46 70 C36 70 30 63 31 56 C40 56 46 62 46 70Z" fill="var(--color-sage-light)" />
          <path d="M46 64 C56 63 62 56 61 49 C52 50 45.5 56 46 64Z" fill="var(--color-good)" />
        </>
      ) : null}
      {stage === 'sprout' ? (
        <>
          <path d="M46 76 C46 72 46 70 46 67" stroke="var(--color-good)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <path d="M46 69 C41 69 39 66 39.5 63 C44 63 46 66 46 69Z" fill="var(--color-sage-light)" />
          <ellipse cx="46" cy="76" rx="4.5" ry="3" fill="var(--color-warn-soft)" />
        </>
      ) : null}
      {stage === 'seed' ? <ellipse cx="46" cy="76" rx="4.5" ry="3" fill="var(--color-warn-soft)" /> : null}
      <CopperPot />
    </svg>
  )
}
