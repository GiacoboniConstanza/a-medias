import { amountForMonth } from './fixed.ts'
import { formatMoney, normalizeMoney } from './format.ts'
import { planItemShares } from './plans.ts'
import { isOpenFixed } from './reminders.ts'
import { loanEffectLines, remainingAfterLoans, type LoanMonthEffect } from './transfers.ts'

export type HomePocket = {
  income: number
  spent: number
  savedIn: number
  savedOut: number
}

export type HomeCardLine = {
  label: string
  amount: string
  role: 'income' | 'spent' | 'ahorro' | 'transfer' | 'estimated' | 'margin'
}

export type OpenFixedForEstimate = {
  applies: boolean
  pausedAt: string | null
  payment: unknown
  hasAmount: boolean
  isShared: boolean
  amount: number
  revisions: { effectiveFrom: string; amount: number }[]
}

/** Arma Te quedan. El monto sale de remainingAfterLoans con aportes/retiros aparte de Gastaste. */
export function homeAccountingCard(pocket: HomePocket, effect: LoanMonthEffect, partnerName: string) {
  const savingsNet = pocket.savedIn - pocket.savedOut
  const remaining = remainingAfterLoans(pocket.income, pocket.spent + savingsNet, effect.net)
  const pocketLines: HomeCardLine[] = [
    line('Cobraste', formatMoney(pocket.income), 'income'),
    line('Gastaste', formatMoney(pocket.spent), 'spent'),
  ]
  if (pocket.savedIn > 0) pocketLines.push(line('Pusiste en ahorros', formatMoney(pocket.savedIn), 'ahorro'))
  if (pocket.savedOut > 0) pocketLines.push(line('Sacaste de ahorros', formatMoney(pocket.savedOut), 'ahorro'))
  const transferLines = loanEffectLines(partnerName, effect).map((row) =>
    line(row.label, formatMoney(row.amount), 'transfer'),
  )
  return {
    remaining,
    remainingText: formatMoney(remaining),
    pocketLines,
    transferLines,
    /** Compat: Cobraste/Gastaste/ahorros + transferencias. */
    lines: [...pocketLines, ...transferLines],
  }
}

/**
 * Suma de fijos abiertos del mes (isOpenFixed): privados enteros, compartidos solo mi parte.
 * Las cuotas fuera de ventana no aplican (applies=false) y no entran.
 */
export function estimatedOpenFixedTotal(input: {
  fixed: readonly OpenFixedForEstimate[]
  meId: string
  partnerId: string | null
  splitPercents: Readonly<Record<string, number>>
  month: string
}): number {
  let total = 0
  for (const item of input.fixed) {
    if (!isOpenFixed(item)) continue
    const amount = amountForMonth(item.revisions, input.month) ?? (item.hasAmount ? item.amount : null)
    if (amount == null || amount <= 0) continue
    if (item.isShared) {
      total = normalizeMoney(
        total + planItemShares(amount, input.meId, input.partnerId, input.splitPercents).myShare,
      )
    } else {
      total = normalizeMoney(total + amount)
    }
  }
  return total
}

/** Margen estimado = Te quedan − fijos estimados (puede ser negativo). */
export function estimatedMargin(remaining: number, estimatedFixed: number): number {
  return normalizeMoney(remaining - estimatedFixed)
}

export function estimatedFixedLine(amount: number): HomeCardLine {
  return line('Gastos fijos estimados', formatMoney(amount), 'estimated')
}

export function estimatedMarginLine(amount: number): HomeCardLine {
  return line('Margen estimado', formatMoney(amount), 'margin')
}

function line(label: string, amount: string, role: HomeCardLine['role']): HomeCardLine {
  return { label, amount, role }
}
