import type { ExpenseItem, FinanceData } from './api.ts'
import { formatMoney, normalizeMoney } from './format.ts'

export type BudgetState = 'normal' | 'cerca' | 'tope' | 'pasado'

export type BudgetCap = {
  categoryId: string
  amount: number
}

export type BudgetRow = {
  categoryId: string
  name: string
  icon: string
  spent: number
  cap: number
  percent: number
  state: BudgetState
}

/** Tu parte de un gasto: privado propio entero; compartido = monto × tu %. */
export function budgetShare(expense: ExpenseItem, meId: string, myPercent: number): number {
  if (!expense.categoryId) return 0
  if (!expense.isShared) {
    return expense.ownerId === meId ? expense.amount : 0
  }
  return normalizeMoney((expense.amount * myPercent) / 100)
}

/** Gastado en la categoría este mes (privados propios + parte de compartidos). */
export function budgetSpent(data: FinanceData, meId: string, categoryId: string): number {
  const myPercent = data.splitEven ? 50 : (data.splitPercents[meId] ?? 50)
  let sum = 0
  for (const expense of data.monthExpenses) {
    if (expense.categoryId !== categoryId) continue
    sum = normalizeMoney(sum + budgetShare(expense, meId, myPercent))
  }
  return sum
}

export function budgetPercent(spent: number, cap: number): number {
  if (cap <= 0) return 0
  return Math.floor((spent / cap) * 100)
}

export function budgetState(spent: number, cap: number): BudgetState {
  if (cap <= 0) return 'normal'
  if (spent > cap) return 'pasado'
  if (spent === cap) return 'tope'
  if (spent / cap >= 0.8) return 'cerca'
  return 'normal'
}

export function budgetOrder(rows: readonly BudgetRow[]): BudgetRow[] {
  return [...rows].sort((left, right) => {
    if (right.percent !== left.percent) return right.percent - left.percent
    return left.name.localeCompare(right.name, 'es')
  })
}

export function budgetRowsForMonth(
  data: FinanceData,
  meId: string,
  caps: readonly BudgetCap[],
): BudgetRow[] {
  const byId = new Map(data.categories.map((category) => [category.id, category]))
  const rows: BudgetRow[] = []
  for (const cap of caps) {
    if (!(cap.amount > 0)) continue
    const category = byId.get(cap.categoryId)
    if (!category) continue
    const spent = budgetSpent(data, meId, cap.categoryId)
    const percent = budgetPercent(spent, cap.amount)
    rows.push({
      categoryId: cap.categoryId,
      name: category.name,
      icon: category.icon,
      spent,
      cap: cap.amount,
      percent,
      state: budgetState(spent, cap.amount),
    })
  }
  return budgetOrder(rows)
}

export function budgetStatusLine(row: BudgetRow): string | null {
  if (row.state === 'pasado') return `Te pasaste por ${formatMoney(row.spent - row.cap)}`
  if (row.state === 'tope') return 'Llegaste al tope'
  if (row.state === 'cerca') return `Cerca del tope: te quedan ${formatMoney(row.cap - row.spent)}`
  return null
}

export function budgetBarFill(state: BudgetState): string {
  if (state === 'pasado') return 'bg-rosa-hondo'
  if (state === 'cerca' || state === 'tope') return 'bg-mostaza'
  return 'bg-azul'
}

export function budgetAriaLabel(row: BudgetRow): string {
  return `${row.name}: gastaste ${formatMoney(row.spent)} de ${formatMoney(row.cap)}, ${row.percent} %`
}

export function budgetAmountLine(row: BudgetRow): string {
  return `${formatMoney(row.spent)} de ${formatMoney(row.cap)}`
}
