import { formatMoney } from './format.ts'
import { loanEffectLines, remainingAfterLoans, type LoanMonthEffect } from './loans.ts'

export type HomePocket = {
  income: number
  spent: number
  savedIn: number
  savedOut: number
}

export type HomeCardLine = {
  label: string
  amount: string
  role: 'income' | 'spent' | 'ahorro' | 'loan'
}

/** Arma Te quedan. El monto sale de remainingAfterLoans con aportes/retiros aparte de Gastaste. */
export function homeAccountingCard(pocket: HomePocket, effect: LoanMonthEffect, partnerName: string) {
  const savingsNet = pocket.savedIn - pocket.savedOut
  const remaining = remainingAfterLoans(pocket.income, pocket.spent + savingsNet, effect.net)
  const lines: HomeCardLine[] = [
    line('Cobraste', formatMoney(pocket.income), 'income'),
    line('Gastaste', formatMoney(pocket.spent), 'spent'),
  ]
  if (pocket.savedIn > 0) lines.push(line('Pusiste en ahorros', formatMoney(pocket.savedIn), 'ahorro'))
  if (pocket.savedOut > 0) lines.push(line('Sacaste de ahorros', formatMoney(pocket.savedOut), 'ahorro'))
  lines.push(...loanEffectLines(partnerName, effect).map((row) => line(row.label, formatMoney(row.amount), 'loan')))
  return {
    remaining,
    remainingText: formatMoney(remaining),
    lines,
  }
}

function line(label: string, amount: string, role: HomeCardLine['role']): HomeCardLine {
  return { label, amount, role }
}
