import type { SproutStage } from '../lib/habits.ts'
import type { ModuleId } from '../lib/modules.ts'
import { Plantita } from './Adornos.tsx'

export function Sprout({ module, muted = false, size = 44 }: { module: ModuleId; muted?: boolean; size?: number }) {
  void module
  const height = Math.round((size * 86) / 66)
  return <Plantita width={size} height={height} className={muted ? 'opacity-55' : ''} />
}


export function DaySprout({ stage }: { stage: SproutStage }) {
  void stage
  return <Plantita width={32} height={42} />
}

export function Planter() {
  return <Plantita width={66} height={86} />
}
