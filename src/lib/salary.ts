import { amountForMonth, type AmountRevision } from './fixed.ts'
import { monthTitle } from './month.ts'
import { shareAmounts, splitByPercents, type SplitResult } from './split.ts'

export type SalaryPoint = AmountRevision & {
  id: string
  createdAt: string
}

/** Sueldo que rige ese mes. Si todavía no había uno, es cero y el reparto queda 50/50. */
export function effectiveSalary(revisions: AmountRevision[], month: string): number {
  return amountForMonth(revisions, month) ?? 0
}

export function latestSalary(records: SalaryPoint[]): SalaryPoint | null {
  return [...records].sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))[0] ?? null
}

/** Porcentajes enteros que suman 100. El primero, ordenado por id, absorbe el redondeo. */
export function salaryPercents(bases: number[]): number[] {
  if (bases.length === 0) return []
  const missing = bases.some((base) => base <= 0)
  const weights = missing ? bases.map(() => 1) : bases
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0)
  const percents = weights.map((weight) => Math.round((weight / weightSum) * 100))
  const drift = 100 - percents.reduce((sum, percent) => sum + percent, 0)
  if (percents[0] !== undefined) percents[0] += drift
  return percents
}

export function monthSalarySplit(input: {
  month: string
  total: number
  people: { id: string; name: string; revisions: AmountRevision[]; paid: number }[]
}): SplitResult {
  const ordered = [...input.people].sort((left, right) => left.id.localeCompare(right.id))
  const bases = ordered.map((person) => effectiveSalary(person.revisions, input.month))
  const percents = salaryPercents(bases)
  return splitByPercents(
    input.total,
    ordered.map((person, index) => ({
      id: person.id,
      name: person.name,
      percent: percents[index] ?? 0,
      paid: person.paid,
    })),
    bases.length > 0 && bases.some((base) => base <= 0),
  )
}

/** Cuánto cambia "me queda" al pasar de un sueldo a otro, con el mismo total compartido. */
export function pocketDelta(input: {
  ids: string[]
  meId: string
  oldPercentById: Record<string, number>
  newPercentById: Record<string, number>
  oldBase: number
  newBase: number
  sharedTotal: number
}): number {
  const ids = [...input.ids].sort()
  const index = ids.indexOf(input.meId)
  const oldShare = shareAmounts(input.sharedTotal, ids.map((id) => input.oldPercentById[id] ?? 0))[index] ?? 0
  const newShare = shareAmounts(input.sharedTotal, ids.map((id) => input.newPercentById[id] ?? 0))[index] ?? 0
  return input.newBase - input.oldBase - (newShare - oldShare)
}

/** El aumento nuevo tiene que quedar después del historial. Editar solo mueve el último. */
export function salaryMonthError(history: { id: string; effectiveFrom: string }[], effectiveFrom: string, editingId: string | null): string {
  if (!effectiveFrom) return 'Elegí el mes.'
  const latest = [...history].sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))[0]
  if (!latest) return ''
  if (editingId) {
    const earlier = history
      .filter((row) => row.id !== editingId)
      .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))[0]
    if (earlier && effectiveFrom <= earlier.effectiveFrom) return 'Ese mes ya está en el historial.'
    return ''
  }
  if (effectiveFrom < latest.effectiveFrom) return 'El aumento tiene que ser posterior al último sueldo.'
  return ''
}

export function visibleSplitNotice<T extends { effectiveFrom: string; createdAt: string }>(notices: T[], todayMonth: string): T | null {
  const upcoming = notices
    .filter((notice) => notice.effectiveFrom >= todayMonth)
    .sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom))[0]
  if (upcoming) return upcoming
  return (
    notices
      .filter((notice) => notice.createdAt >= todayMonth)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null
  )
}

export function sinceLabel(month: string): string {
  const title = monthTitle(month)
  return title.charAt(0).toLowerCase() + title.slice(1)
}
