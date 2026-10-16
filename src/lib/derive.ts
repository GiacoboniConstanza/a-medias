import type { FinanceData } from './api.ts'
import { daysInMonth, isCurrentMonth } from './month.ts'
import { debtSentence, splitShared, type SplitResult } from './split.ts'

export function partnerId(data: FinanceData, meId: string): string | null {
  return Object.keys(data.names).find((id) => id !== meId) ?? null
}

export function monthSplit(data: FinanceData): SplitResult {
  const shared = data.monthExpenses.filter((expense) => expense.isShared)
  const total = shared.reduce((sum, expense) => sum + expense.amount, 0)
  const people = Object.keys(data.names).map((id) => ({
    id,
    name: data.names[id] ?? 'Sin nombre',
    base: data.bases[id] ?? 0,
    paid: shared.filter((expense) => expense.payerId === id).reduce((sum, expense) => sum + expense.amount, 0),
  }))
  return splitShared(total, people)
}

export function myPrivateSpent(data: FinanceData, meId: string): number {
  return data.monthExpenses
    .filter((expense) => !expense.isShared && expense.ownerId === meId)
    .reduce((sum, expense) => sum + expense.amount, 0)
}

export function paceInput(month: string, today = new Date()) {
  const [yearText, monthText] = month.split('-')
  const current = isCurrentMonth(month, today)
  return {
    dayOfMonth: current ? today.getDate() : daysInMonth(month),
    daysInMonth: daysInMonth(month),
    isCurrentMonth: current,
    year: Number(yearText),
    monthNumber: Number(monthText),
  }
}

export function debtCopy(meId: string, result: SplitResult): string {
  return debtSentence(meId, result)
}
