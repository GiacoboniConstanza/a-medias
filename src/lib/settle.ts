import { formatMoney, normalizeMoney } from './format.ts'
import { monthEnd } from './month.ts'
import type { SplitResult } from './split.ts'

export type SettleLoan = {
  id: string
  lenderId: string
  borrowerId: string
  pending: number
  period: string
}

export type PlannedRepayment = {
  loanId: string
  lenderId: string
  borrowerId: string
  amount: number
  paidOn: string
  period: string
}

export type MonthSettlementPlan = {
  month: string
  expenseAmount: number
  loanAmount: number
  expenseDebtorId: string | null
  debtorId: string | null
  creditorId: string | null
  amount: number
  repayments: PlannedRepayment[]
  canSettle: boolean
  blockedReason: string | null
}

export type TaggedRepayment = {
  lenderId: string
  borrowerId: string
  amount: number
  period: string
  settlementId: string | null
}

function periodKey(value: string): string {
  return value.slice(0, 10)
}

/** Préstamos con pendiente cuyo período es el mes que se salda o uno anterior. */
export function loansInSettlement(month: string, meId: string, partnerId: string | null, loans: readonly SettleLoan[]): SettleLoan[] {
  const monthKey = periodKey(month)
  if (!partnerId) return []
  return loans.filter((loan) => {
    if (normalizeMoney(loan.pending) <= 0) return false
    if (periodKey(loan.period) > monthKey) return false
    const between =
      (loan.lenderId === meId && loan.borrowerId === partnerId) ||
      (loan.lenderId === partnerId && loan.borrowerId === meId)
    return between
  })
}

function signedPending(personId: string, loans: readonly SettleLoan[]): number {
  let signed = 0
  for (const loan of loans) {
    if (loan.lenderId === personId) signed += loan.pending
    else if (loan.borrowerId === personId) signed -= loan.pending
  }
  return normalizeMoney(signed)
}

/** Arma el saldo del mes. El reparto de gastos llega ya calculado. */
export function planMonthSettlement(input: {
  month: string
  meId: string
  partnerId: string | null
  split: SplitResult
  loans: readonly SettleLoan[]
  alreadySettled: boolean
}): MonthSettlementPlan {
  const included = loansInSettlement(input.month, input.meId, input.partnerId, input.loans)
  const paidOn = monthEnd(input.month)
  const repayments = included.map((loan) => ({
    loanId: loan.id,
    lenderId: loan.lenderId,
    borrowerId: loan.borrowerId,
    amount: normalizeMoney(loan.pending),
    paidOn,
    period: periodKey(input.month),
  }))
  const expenseAmount = normalizeMoney(input.split.amount)
  let expenseSigned = 0
  if (expenseAmount !== 0 && input.split.creditorId === input.meId) expenseSigned = expenseAmount
  else if (expenseAmount !== 0 && input.split.debtorId === input.meId) expenseSigned = -expenseAmount
  const loanSigned = signedPending(input.meId, included)
  const net = normalizeMoney(expenseSigned + loanSigned)
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
    loanAmount: normalizeMoney(Math.abs(loanSigned)),
    expenseDebtorId: expenseAmount > 0 ? input.split.debtorId : null,
    debtorId,
    creditorId,
    amount,
    repayments,
    canSettle,
    blockedReason: input.alreadySettled || canSettle ? null : 'No hay nada para saldar este mes.',
  }
}

export function withoutSettlementRepayments<T extends { settlementId: string | null }>(
  rows: readonly T[],
  settlementId: string,
): T[] {
  return rows.filter((row) => row.settlementId !== settlementId)
}

/** Neto absoluto de las devoluciones de un saldo, para la barra cuando ya no hay pendiente. */
export function linkedLoanAmount(rows: readonly { lenderId: string; borrowerId: string; amount: number }[]): number {
  const anchor = rows[0]
  if (!anchor) return 0
  let signed = 0
  for (const row of rows) {
    if (row.lenderId === anchor.lenderId) signed += row.amount
    else if (row.borrowerId === anchor.lenderId) signed -= row.amount
  }
  return normalizeMoney(Math.abs(signed))
}

export function passPhrase(partnerName: string, meIsCreditor: boolean, amount: number): string {
  const money = formatMoney(amount)
  if (meIsCreditor) return `${partnerName} te pasa ${money}`
  return `Le pasás ${money} a ${partnerName}`
}
