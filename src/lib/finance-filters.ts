import type { DatePreset, ExpenseSpan } from './expense-range.ts'

export type ScopeFilter = 'all' | 'shared' | 'private'
export type PaidFilter = 'all' | 'pending' | 'paid'

export type ListFilters = {
  scope: ScopeFilter
  categoryIds: string[]
  paid: PaidFilter
}

export const SCOPE_CHIPS: { id: ScopeFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'shared', label: 'Compartidos' },
  { id: 'private', label: 'Privados' },
]

export const PAID_CHIPS: { id: PaidFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'pending', label: 'Pendiente' },
  { id: 'paid', label: 'Pagado' },
]

export function matchesScope(isShared: boolean, scope: ScopeFilter): boolean {
  if (scope === 'all') return true
  return scope === 'shared' ? isShared : !isShared
}

export function matchesCategories(categoryId: string | null | undefined, categoryIds: string[]): boolean {
  if (categoryIds.length === 0) return true
  return categoryId != null && categoryIds.includes(categoryId)
}

export function matchesPaid(paid: boolean, filter: PaidFilter): boolean {
  if (filter === 'all') return true
  return filter === 'paid' ? paid : !paid
}

export function dueDateForMonth(dueDay: number, month: string): string {
  return `${month.slice(0, 8)}${String(dueDay).padStart(2, '0')}`
}

export function matchesSpan(isoDate: string, span: ExpenseSpan): boolean {
  if (span.kind === 'dates') return span.dates.includes(isoDate)
  return isoDate >= span.from && isoDate <= span.to
}

export function filterByScopeAndCategory<T extends { isShared: boolean; categoryId: string | null }>(
  items: T[],
  filters: Pick<ListFilters, 'scope' | 'categoryIds'>,
): T[] {
  return items.filter(
    (item) => matchesScope(item.isShared, filters.scope) && matchesCategories(item.categoryId, filters.categoryIds),
  )
}

export function filterReminders<T extends { isShared: boolean; categoryId: string | null; dueDay: number; payment: unknown }>(
  items: T[],
  filters: ListFilters,
  month: string,
  span: ExpenseSpan,
  preset: DatePreset,
): T[] {
  return items.filter((item) => {
    if (!matchesScope(item.isShared, filters.scope)) return false
    if (!matchesCategories(item.categoryId, filters.categoryIds)) return false
    if (!matchesPaid(item.payment != null, filters.paid)) return false
    if (preset === 'month') return true
    return matchesSpan(dueDateForMonth(item.dueDay, month), span)
  })
}
