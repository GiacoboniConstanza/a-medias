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

/** Texto de «Te quedan» en la ConfirmSheet de saldar. */
export function settleTransferConfirmCopy(registerTransfer: boolean, meIsCreditor: boolean): string {
  if (!registerTransfer) return 'Eso no cambia lo que te queda.'
  if (meIsCreditor) return 'Se registra la transferencia y se suma a lo que te queda.'
  return 'Se registra la transferencia y se descuenta de lo que te queda.'
}

export type SettlePaidCheck = {
  ok: boolean
  paid: number
  forgiven: number
  error: string | null
}

/** Monto a pagar al saldar: > 0 y ≤ saldo total, 2 decimales. */
export function checkSettlePaidAmount(paidRaw: number, total: number): SettlePaidCheck {
  const paid = normalizeMoney(paidRaw)
  const max = normalizeMoney(total)
  if (!(paid > 0) || paid > max) {
    return {
      ok: false,
      paid,
      forgiven: 0,
      error: 'El monto tiene que ser mayor a 0 y como máximo el saldo.',
    }
  }
  return {
    ok: true,
    paid,
    forgiven: normalizeMoney(max - paid),
    error: null,
  }
}

export function settleForgivenCopy(forgiven: number): string | null {
  const amount = normalizeMoney(forgiven)
  if (amount <= 0) return null
  return `Se cierra con ${formatMoney(amount)} de diferencia`
}

/** Aviso en la hoja cuando el mes ya está saldado. */
export function settledMonthBanner(amount: number, expectedAmount: number | null | undefined): string {
  const paid = normalizeMoney(amount)
  const expected = expectedAmount == null ? null : normalizeMoney(expectedAmount)
  if (expected != null && paid < expected) {
    return `Mes saldado por ${formatMoney(paid)}, con ${formatMoney(expected - paid)} de diferencia.`
  }
  return 'Mes saldado.'
}
