import { formatMoney } from './format.ts'
import { formatSignedMoney, hasLoanMovement, loanEffectLines, remainingAfterLoans, type LoanMonthEffect } from './loans.ts'

export type HomePocket = {
  base: number
  extras: number
  income: number
  sharedShare: number
  privateSpent: number
  spent: number
}

export type HomeCardLine = {
  label: string
  amount: string
  role: 'detail' | 'income' | 'spent' | 'loan'
}

/** Arma las filas visibles de Me queda. El monto sale de remainingAfterLoans, sin recalcular. */
export function homeAccountingCard(pocket: HomePocket, effect: LoanMonthEffect) {
  const remaining = remainingAfterLoans(pocket.income, pocket.spent, effect.net)
  const loans = loanEffectLines(effect)
    .filter((line) => line.label !== 'Préstamos (neto)')
    .map((line) => ({
      label: line.label,
      amount: formatSignedMoney(line.amount),
      role: 'loan' as const,
    }))
  return {
    remaining,
    remainingText: formatMoney(remaining),
    income: [
      line('Sueldo base', formatMoney(pocket.base), 'detail'),
      line('Extras', formatMoney(pocket.extras), 'detail'),
      line('Ingresos', formatMoney(pocket.income), 'income'),
    ],
    spent: [
      line('Mi parte compartidos', formatMoney(pocket.sharedShare), 'detail'),
      line('Privados', formatMoney(pocket.privateSpent), 'detail'),
      line('Gastos del mes', formatMoney(pocket.spent), 'spent'),
    ],
    loans,
    showLoans: hasLoanMovement(effect) && loans.length > 0,
  }
}

function line(label: string, amount: string, role: HomeCardLine['role']): HomeCardLine {
  return { label, amount, role }
}
