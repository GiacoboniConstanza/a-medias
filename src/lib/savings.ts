import { matchesScope, type ScopeFilter } from './finance-filters.ts'

export type SavingInput = {
  id: string
  name: string
  icon: string
  target: number
  targetDate: string | null
  saved: number
}

export type SavingGoalInput = {
  id: string
  name: string
  icon: string
  target: number
  targetDate: string | null
  byUser: readonly { amount: number }[]
}

export type SavingSource = SavingInput & { shared: boolean }

export const SAVINGS_SCOPE_STORAGE_KEY = 'a-medias.ahorros.alcance'

export function goalSaved(byUser: readonly { amount: number }[]): number {
  return byUser.reduce((sum, item) => sum + item.amount, 0)
}

/** Fondos privados (`savings_funds`) y la meta compartida (`shared_goals`), sin mezclar las tablas. */
export function savingSources(funds: readonly SavingInput[], goal: SavingGoalInput | null): SavingSource[] {
  const shared: SavingSource[] = goal
    ? [
        {
          id: goal.id,
          name: goal.name,
          icon: goal.icon,
          target: goal.target,
          targetDate: goal.targetDate,
          saved: goalSaved(goal.byUser),
          shared: true,
        },
      ]
    : []
  return [
    ...shared,
    ...funds.map((fund) => ({
      id: fund.id,
      name: fund.name,
      icon: fund.icon,
      target: fund.target,
      targetDate: fund.targetDate,
      saved: fund.saved,
      shared: false,
    })),
  ]
}

export function filterSavings<T extends { shared: boolean }>(items: readonly T[], scope: ScopeFilter): T[] {
  return items.filter((item) => matchesScope(item.shared, scope))
}

export function savingTotals(items: readonly { shared: boolean; saved: number }[]): {
  all: number
  shared: number
  private: number
} {
  let shared = 0
  let privateSaved = 0
  for (const item of items) {
    if (item.shared) shared += item.saved
    else privateSaved += item.saved
  }
  return { all: shared + privateSaved, shared, private: privateSaved }
}

export function savingPercent(saved: number, target: number): number {
  if (target <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((saved / target) * 100)))
}

export function scopeFromSearch(value: string | null): ScopeFilter | null {
  if (value === 'all' || value === 'shared' || value === 'private') return value
  return null
}

/** La ruta vieja manda sobre lo último que eligió. */
export function rememberedSavingsScope(stored: string | null, search: string | null): ScopeFilter {
  return scopeFromSearch(search) ?? scopeFromSearch(stored) ?? 'all'
}

export function legacySavingsLocation(pathname: string): string | null {
  if (pathname === '/bolsa') return '/ahorros?alcance=private'
  if (pathname === '/meta') return '/ahorros?alcance=shared'
  return null
}
