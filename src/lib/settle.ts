import { formatMoney, normalizeMoney } from './format.ts'
import type { SplitResult } from './split.ts'

export type MonthSettlementPlan = {
  month: string
  expenseAmount: number
  expenseDebtorId: string | null
  debtorId: string | null
  creditorId: string | null
  amount: number
  canSettle: boolean
  blockedReason: string | null
}

function periodKey(value: string): string {
  return value.slice(0, 10)
}

/** Arma el saldo del mes. Solo el reparto de gastos compartidos (P2). */
export function planMonthSettlement(input: {
  month: string
  meId: string
  partnerId: string | null
  split: SplitResult
  alreadySettled: boolean
}): MonthSettlementPlan {
  const expenseAmount = normalizeMoney(input.split.amount)
  let expenseSigned = 0
  if (expenseAmount !== 0 && input.split.creditorId === input.meId) expenseSigned = expenseAmount
  else if (expenseAmount !== 0 && input.split.debtorId === input.meId) expenseSigned = -expenseAmount
  const net = normalizeMoney(expenseSigned)
  let debtorId: string | null = null
  let creditorId: string | null = null
  let amount = 0
  if (input.partnerId && net !== 0) {
    amount = normalizeMoney(Math.abs(net))
    if (net > 0) {
      creditorId = input.meId
      debtorId = input.partnerId
    } else {
      debtorId = input.meId
      creditorId = input.partnerId
    }
  }
  const canSettle = !input.alreadySettled && amount > 0 && debtorId !== null && creditorId !== null
  return {
    month: periodKey(input.month),
    expenseAmount,
    expenseDebtorId: expenseAmount > 0 ? input.split.debtorId : null,
    debtorId,
    creditorId,
    amount,
    canSettle,
    blockedReason: input.alreadySettled || canSettle ? null : 'No hay nada para saldar este mes.',
  }
}

export function passPhrase(partnerName: string, meIsCreditor: boolean, amount: number): string {
  const money = formatMoney(amount)
  if (meIsCreditor) return `${partnerName} te pasa ${money}`
  return `Le pasás ${money} a ${partnerName}`
}
