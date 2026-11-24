import { formatMoney, normalizeMoney, toCents } from './format.ts'
import { effectiveSalary, type SalaryPoint } from './salary.ts'
import { shareAmounts } from './split.ts'

export type PlanItem = {
  id: string
  title: string
  amount: number
  note: string | null
  tag: string | null
  isPrivate: boolean
  ownerId: string | null
  chosen: boolean
  expenseId: string | null
  expenseAmount: number | null
  expensePeriod: string | null
}

export type PartnerPlanStatus = 'alcanza' | 'no_alcanza' | 'falta_sueldo'

/** Tu parte de un ítem compartido (misma regla que Gastos fijos). */
export function planItemShares(
  amount: number,
  meId: string,
  partnerId: string | null,
  splitPercents: Readonly<Record<string, number>>,
): { myShare: number; partnerShare: number } {
  if (!partnerId) {
    return { myShare: normalizeMoney(amount), partnerShare: 0 }
  }
  const ids = [meId, partnerId].sort()
  const parts = shareAmounts(
    amount,
    ids.map((id) => splitPercents[id] ?? 0),
  )
  return {
    myShare: parts[ids.indexOf(meId)] ?? 0,
    partnerShare: parts[ids.indexOf(partnerId)] ?? 0,
  }
}

/** Lo que te toca poner de un ítem (compartido → tu parte; privado → entero). */
export function myPlanCost(
  item: Pick<PlanItem, 'amount' | 'isPrivate'>,
  meId: string,
  partnerId: string | null,
  splitPercents: Readonly<Record<string, number>>,
): number {
  if (item.isPrivate) return normalizeMoney(item.amount)
  return planItemShares(item.amount, meId, partnerId, splitPercents).myShare
}

/**
 * Sueldo del mes para Planes: suma de todas las filas de ese mes desde el corte
 * (misma regla que effectiveSalary / private.bases_at).
 */
export function planSalaryForMonth(history: readonly SalaryPoint[], month: string): number {
  return effectiveSalary([...history], month)
}

/** Margen = sueldo − tu parte de fijos compartidos − tus fijos privados. */
export function planMargin(salary: number, myFixedShare: number, myPrivateFixed: number): number | null {
  if (salary <= 0) return null
  return normalizeMoney(salary - myFixedShare - myPrivateFixed)
}

/** Tu parte de elegidos + comprados este mes desde Planes. */
export function planCommitted(
  items: readonly PlanItem[],
  meId: string,
  partnerId: string | null,
  splitPercents: Readonly<Record<string, number>>,
  month: string,
): number {
  let cents = 0
  for (const item of items) {
    if (item.expenseId && item.expensePeriod === month && item.expenseAmount != null) {
      const amount = item.isPrivate
        ? item.expenseAmount
        : planItemShares(item.expenseAmount, meId, partnerId, splitPercents).myShare
      cents += toCents(amount)
      continue
    }
    if (item.chosen && !item.expenseId) {
      cents += toCents(myPlanCost(item, meId, partnerId, splitPercents))
    }
  }
  return cents / 100
}

export function planRemaining(margin: number, committed: number): number {
  return normalizeMoney(margin - committed)
}

export function sortPlanItems(items: readonly PlanItem[]): PlanItem[] {
  return [...items].sort((left, right) => {
    const leftOpen = !left.expenseId
    const rightOpen = !right.expenseId
    if (leftOpen !== rightOpen) return leftOpen ? -1 : 1
    if (leftOpen) {
      if (left.chosen !== right.chosen) return left.chosen ? -1 : 1
      if (left.amount !== right.amount) return left.amount - right.amount
      return left.title.localeCompare(right.title, 'es')
    }
    return left.title.localeCompare(right.title, 'es')
  })
}

export function openPlanItems(items: readonly PlanItem[]): PlanItem[] {
  return sortPlanItems(items.filter((item) => !item.expenseId))
}

export function boughtPlanItems(items: readonly PlanItem[]): PlanItem[] {
  return sortPlanItems(items.filter((item) => item.expenseId))
}

export function planTags(items: readonly PlanItem[]): string[] {
  const counts = new Map<string, { label: string; count: number }>()
  for (const item of items) {
    if (!item.tag) continue
    const key = item.tag.toLocaleLowerCase('es')
    const prev = counts.get(key)
    if (!prev) counts.set(key, { label: item.tag, count: 1 })
    else {
      prev.count += 1
      // Prefer the most common casing; keep first if tied
    }
  }
  return [...counts.values()]
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))
    .map((row) => row.label)
}

export function filterPlanItemsByTag(items: readonly PlanItem[], tag: string | null): PlanItem[] {
  if (!tag) return [...items]
  const key = tag.toLocaleLowerCase('es')
  return items.filter((item) => item.tag?.toLocaleLowerCase('es') === key)
}

export function partnerStatusLabel(
  partnerName: string,
  status: PartnerPlanStatus | null,
): string | null {
  if (!status) return null
  const name = partnerName.trim() || 'tu compañera'
  if (status === 'alcanza') return `${name}: alcanza`
  if (status === 'no_alcanza') return `${name}: no alcanza`
  return `${name}: falta sueldo`
}

export function partnerStatusTone(status: PartnerPlanStatus | null): 'ok' | 'bad' | 'warn' | null {
  if (status === 'alcanza') return 'ok'
  if (status === 'no_alcanza') return 'bad'
  if (status === 'falta_sueldo') return 'warn'
  return null
}

export function formatChosenDelta(amount: number): string {
  if (amount <= 0) return formatMoney(0)
  return `− ${formatMoney(amount)}`
}

export function normalizePlanTag(raw: string): string | null {
  const cleaned = raw.trim().replace(/\s+/g, ' ').slice(0, 24)
  return cleaned.length > 0 ? cleaned : null
}

export function normalizePlanNote(raw: string): string | null {
  const cleaned = raw.trim()
  if (!cleaned) return null
  return cleaned.slice(0, 500)
}
