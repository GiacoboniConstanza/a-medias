import type { SavingItem } from './api.ts'
import { savingBalances, type SavingBalanceMove } from './saving-balance.ts'

export function activeSavings<T extends { archivedAt?: string | null }>(items: readonly T[]): T[] {
  return items.filter((item) => !item.archivedAt)
}

export function archivedSavings<T extends { archivedAt?: string | null }>(items: readonly T[]): T[] {
  return items.filter((item) => Boolean(item.archivedAt))
}

/** Compartidos primero, después los tuyos; dentro de cada grupo, el orden de llegada. */
export function groupSavings(items: readonly SavingItem[]): {
  shared: SavingItem[]
  own: SavingItem[]
} {
  const shared: SavingItem[] = []
  const own: SavingItem[] = []
  for (const item of items) {
    if (item.isShared) shared.push(item)
    else own.push(item)
  }
  return { shared, own }
}

export function savingPercent(saved: number, target: number | null): number {
  if (target == null || target <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((saved / target) * 100)))
}

export function savingTotalFor(
  saving: SavingItem,
  moves: readonly SavingBalanceMove[],
): ReturnType<typeof savingBalances> {
  return savingBalances(saving.openings, moves)
}

export function legacySavingsLocation(pathname: string): string | null {
  if (pathname === '/bolsa' || pathname === '/meta') return '/ahorros'
  return null
}
