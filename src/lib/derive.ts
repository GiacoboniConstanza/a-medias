import type { FinanceData } from './api.ts'
import { debtSentence, splitByPercents, type SplitResult } from './split.ts'

export function partnerId(data: FinanceData, meId: string): string | null {
  return Object.keys(data.names).find((id) => id !== meId) ?? null
}

export function monthSplit(data: FinanceData): SplitResult {
  const shared = data.monthExpenses.filter((expense) => expense.isShared)
  const total = shared.reduce((sum, expense) => sum + expense.amount, 0)
  const people = Object.keys(data.names)
    .sort()
    .map((id) => ({
      id,
      name: data.names[id] ?? 'Sin nombre',
      percent: data.splitPercents[id] ?? 0,
      paid: shared.filter((expense) => expense.payerId === id).reduce((sum, expense) => sum + expense.amount, 0),
    }))
  return splitByPercents(total, people, data.splitEven)
}

export function myPrivateSpent(data: FinanceData, meId: string): number {
  return data.monthExpenses
    .filter((expense) => !expense.isShared && expense.ownerId === meId)
    .reduce((sum, expense) => sum + expense.amount, 0)
}
export function debtCopy(meId: string, result: SplitResult): string {
  return debtSentence(meId, result)
}

/** Gastado es plata que salió en gastos. Los aportes/retiros van aparte (P14). */
export function monthPocket(input: {
  base: number
  privateSpent: number
  sharedPaid: number
  extras: number
  savedIn?: number
  savedOut?: number
}) {
  const spent = input.privateSpent + input.sharedPaid
  const income = input.base + input.extras
  const savedIn = input.savedIn ?? 0
  const savedOut = input.savedOut ?? 0
  return {
    remaining: income - spent - savedIn + savedOut,
    spent,
    privateSpent: input.privateSpent,
    sharedPaid: input.sharedPaid,
    base: input.base,
    extras: input.extras,
    income,
    savedIn,
    savedOut,
  }
}
