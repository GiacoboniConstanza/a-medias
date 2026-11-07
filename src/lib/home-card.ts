import { formatMoney } from './format.ts'
import { loanEffectLines, remainingAfterLoans, type LoanMonthEffect } from './loans.ts'

export type HomePocket = {
  income: number
  spent: number
}

export type HomeCardLine = {
  label: string
  amount: string
  role: 'income' | 'spent' | 'loan'
}

/** Arma Te quedan. El monto sale de remainingAfterLoans: ingresos, lo pagado y las transferencias del mes. */
export function homeAccountingCard(pocket: HomePocket, effect: LoanMonthEffect, partnerName: string) {
  const remaining = remainingAfterLoans(pocket.income, pocket.spent, effect.net)
  return {
    remaining,
    remainingText: formatMoney(remaining),
    lines: [
      line('Cobraste', formatMoney(pocket.income), 'income'),
      line('Gastaste', formatMoney(pocket.spent), 'spent'),
      ...loanEffectLines(partnerName, effect).map((row) => line(row.label, formatMoney(row.amount), 'loan')),
    ],
  }
}

function line(label: string, amount: string, role: HomeCardLine['role']): HomeCardLine {
  return { label, amount, role }
}
