import { describe, expect, it } from 'vitest'
import { monthPocket } from './derive.ts'
import { formatMoney } from './format.ts'
import { homeAccountingCard } from './home-card.ts'
import { loanEffectLines, loanMonthEffect, remainingAfterLoans } from './loans.ts'

const coty = 'coty'
const maru = 'maru'

describe('tarjeta Te quedan', () => {
  const pocket = monthPocket({ base: 1_000, privateSpent: 50, sharedPaid: 100, extras: 200 })
  const theoreticalShare = 90

  it('cobra el sueldo, gasta lo pagado y deja afuera la parte teórica', () => {
    const effect = loanMonthEffect(coty, '2026-11-01', [], [])
    const card = homeAccountingCard(pocket, effect, 'Maru')

    expect(pocket.income).toBe(1_200)
    expect(pocket.spent).toBe(150)
    expect(pocket.spent).not.toBe(50 + theoreticalShare)
    expect(card.remaining).toBe(1_050)
    expect(card.remaining).toBe(remainingAfterLoans(pocket.income, pocket.spent, effect.net))
    expect(card.remaining).not.toBe(remainingAfterLoans(pocket.income, 50 + theoreticalShare, effect.net))
    expect(card.remainingText).toBe(formatMoney(card.remaining))
    expect(card.lines.map((row) => row.label)).toEqual(['Cobraste', 'Gastaste', 'Maru te pasó', 'Le pasaste a Maru'])
    expect(card.lines.find((row) => row.label === 'Cobraste')?.amount).toBe(formatMoney(1_200))
    expect(card.lines.find((row) => row.label === 'Gastaste')?.amount).toBe(formatMoney(150))
    expect(card.lines.find((row) => row.label === 'Maru te pasó')?.amount).toBe(formatMoney(0))
    expect(card.lines.find((row) => row.label === 'Le pasaste a Maru')?.amount).toBe(formatMoney(0))
    expect(card.lines.map((row) => row.label)).not.toContain('Mi parte compartidos')
    expect(card.lines.map((row) => row.label)).not.toContain('Préstamos (neto)')
  })

  it('suma lo que entra y resta lo que sale, en los dos sentidos y con devoluciones', () => {
    const loans = [
      { lenderId: coty, borrowerId: maru, amount: 300, period: '2026-11-01' },
      { lenderId: maru, borrowerId: coty, amount: 40, period: '2026-11-01' },
    ]
    const repayments = [
      { lenderId: coty, borrowerId: maru, amount: 100, period: '2026-11-01' },
      { lenderId: maru, borrowerId: coty, amount: 20, period: '2026-11-01' },
    ]
    const effect = loanMonthEffect(coty, '2026-11-01', loans, repayments)
    const card = homeAccountingCard(pocket, effect, 'Maru')

    expect(effect).toMatchObject({ given: 300, received: 40, collected: 100, paid: 20, net: -180 })
    expect(card.lines.find((row) => row.label === 'Maru te pasó')?.amount).toBe(formatMoney(140))
    expect(card.lines.find((row) => row.label === 'Le pasaste a Maru')?.amount).toBe(formatMoney(320))
    expect(card.lines.map((row) => row.amount).slice(2)).toEqual(
      loanEffectLines('Maru', effect).map((row) => formatMoney(row.amount)),
    )
    expect(card.remaining).toBe(870)
    expect(card.remaining).toBe(remainingAfterLoans(pocket.income, pocket.spent, effect.net))
    expect(card.lines.map((row) => row.label)).not.toContain('Préstamos (neto)')
  })

  it('la devolución cuenta en su período y un mes sin movimientos queda en cero', () => {
    const loans = [{ lenderId: coty, borrowerId: maru, amount: 200, period: '2026-11-01' }]
    const repayments = [{ lenderId: coty, borrowerId: maru, amount: 80, period: '2026-12-01' }]
    const december = loanMonthEffect(coty, '2026-12-01', loans, repayments)
    const october = loanMonthEffect(coty, '2026-10-01', loans, repayments)
    const decemberCard = homeAccountingCard(pocket, december, 'Maru')
    const octoberCard = homeAccountingCard(pocket, october, 'Maru')

    expect(decemberCard.remaining).toBe(remainingAfterLoans(pocket.income, pocket.spent, december.net))
    expect(decemberCard.lines.find((row) => row.label === 'Maru te pasó')?.amount).toBe(formatMoney(80))
    expect(decemberCard.lines.find((row) => row.label === 'Le pasaste a Maru')?.amount).toBe(formatMoney(0))
    expect(octoberCard.remaining).toBe(1_050)
    expect(octoberCard.lines.find((row) => row.label === 'Maru te pasó')?.amount).toBe(formatMoney(0))
    expect(octoberCard.lines.find((row) => row.label === 'Le pasaste a Maru')?.amount).toBe(formatMoney(0))
    expect(octoberCard.lines.map((row) => row.label)).not.toContain('Préstamos (neto)')
  })
})
