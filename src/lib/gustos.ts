export type GustosLevel = 'ok' | 'low' | 'over'

export type GustosStatus = {
  level: GustosLevel
  allocated: number
  spent: number
  remaining: number
}

export function gustosStatus(allocated: number, spent: number): GustosStatus {
  const remaining = allocated - spent
  if (remaining < 0) {
    return { level: 'over', allocated, spent, remaining }
  }
  if (allocated > 0 && remaining <= allocated * 0.25) {
    return { level: 'low', allocated, spent, remaining }
  }
  return { level: 'ok', allocated, spent, remaining }
}
