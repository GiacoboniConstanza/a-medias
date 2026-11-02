import { describe, expect, it } from 'vitest'
import { monthPocket } from './derive.ts'
import { formatMoney } from './format.ts'
import { homeAccountingCard } from './home-card.ts'
import { formatSignedMoney, loanEffectLines, loanMonthEffect, remainingAfterLoans } from './loans.ts'

const coty = 'coty'
const maru = 'maru'

describe('tarjeta Me queda', () => {
  const loans = [{ lenderId: coty, borrowerId: maru, amount: 200_000, period: '2026-11-01' }]
  const repayments = [{ lenderId: coty, borrowerId: maru, amount: 80_000, period: '2026-12-01' }]
  const pocket = monthPocket({ base: 900_000, privateSpent: 72_000, myShare: 30_000, extras: 300_000 })

  it('muestra los mismos montos que las funciones de cálculo y omite Préstamos (neto)', () => {
    const effect = loanMonthEffect(coty, '2026-11-01', loans, repayments)
    const card = homeAccountingCard(pocket, effect)
    const labels = [...card.income, ...card.spent, ...card.loans].map((row) => row.label)

    expect(card.remaining).toBe(remainingAfterLoans(pocket.income, pocket.spent, effect.net))
    expect(card.remainingText).toBe(formatMoney(card.remaining))
    expect(card.income.find((row) => row.label === 'Sueldo base')?.amount).toBe(formatMoney(pocket.base))
    expect(card.income.find((row) => row.label === 'Extras')?.amount).toBe(formatMoney(pocket.extras))
    expect(card.income.find((row) => row.label === 'Ingresos')?.amount).toBe(formatMoney(pocket.income))
    expect(card.spent.find((row) => row.label === 'Mi parte compartidos')?.amount).toBe(formatMoney(pocket.sharedShare))
    expect(card.spent.find((row) => row.label === 'Privados')?.amount).toBe(formatMoney(pocket.privateSpent))
    expect(card.spent.find((row) => row.label === 'Gastos del mes')?.amount).toBe(formatMoney(pocket.spent))
    expect(card.loans.map((row) => row.label)).toEqual(loanEffectLines(effect).map((row) => row.label))
    expect(card.loans.map((row) => row.amount)).toEqual(loanEffectLines(effect).map((row) => formatSignedMoney(row.amount)))
    expect(labels).not.toContain('Préstamos (neto)')
    expect(card.showLoans).toBe(true)
  })

  it('lista la devolución del período y no arma un subtotal de préstamos', () => {
    const effect = loanMonthEffect(coty, '2026-12-01', loans, repayments)
    const card = homeAccountingCard(pocket, effect)

    expect(card.remaining).toBe(remainingAfterLoans(pocket.income, pocket.spent, effect.net))
    expect(card.loans).toEqual([{ label: 'Devoluciones cobradas', amount: formatSignedMoney(80_000), role: 'loan' }])
    expect(card.loans.map((row) => row.label)).not.toContain('Préstamos (neto)')
  })

  it('no muestra préstamos si el período no tiene movimientos', () => {
    const effect = loanMonthEffect(coty, '2026-10-01', loans, repayments)
    const card = homeAccountingCard(pocket, effect)

    expect(card.remaining).toBe(remainingAfterLoans(pocket.income, pocket.spent, effect.net))
    expect(card.loans).toEqual([])
    expect(card.showLoans).toBe(false)
    expect([...card.income, ...card.spent].map((row) => row.label)).not.toContain('Préstamos (neto)')
  })
})
