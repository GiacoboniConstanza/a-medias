import { Plantita } from './Adornos.tsx'

export type PlantStage = 'lush' | 'steady' | 'wilted' | 'sprout'

export function plantStage(percent: number, empty: boolean): PlantStage {
  if (empty) return 'sprout'
  if (percent >= 50) return 'lush'
  if (percent >= 25) return 'steady'
  return 'wilted'
}

/** 0 semilla, menos de 25 brote, menos de 75 mediana, desde 75 planta grande. */
export type PotStage = 'seed' | 'sprout' | 'medium' | 'grown'

export type PotVariant = 'fondo' | 'gustos'

export function potStage(percent: number): PotStage {
  if (!Number.isFinite(percent) || percent <= 0) return 'seed'
  const value = Math.min(percent, 100)
  if (value < 25) return 'sprout'
  if (value < 75) return 'medium'
  return 'grown'
}

export function Plant({ stage }: { stage: PlantStage }) {
  void stage
  return <Plantita width={66} height={86} />
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
  void variant
  void potStage(progress)
  return <Plantita width={44} height={44} className={className} />
}
