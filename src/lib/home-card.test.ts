import { describe, expect, it } from 'vitest'
import { monthPocket } from './derive.ts'
import { formatMoney } from './format.ts'
import {
  estimatedMargin,
  estimatedOpenFixedTotal,
  homeAccountingCard,
  type OpenFixedForEstimate,
} from './home-card.ts'
import { loanEffectLines, loanMonthEffect, remainingAfterLoans } from './transfers.ts'

const coty = 'coty'
const maru = 'maru'

function fixed(partial: Partial<OpenFixedForEstimate> & Pick<OpenFixedForEstimate, 'amount' | 'isShared'>): OpenFixedForEstimate {
  return {
    applies: true,
    pausedAt: null,
    payment: null,
    hasAmount: true,
    revisions: [{ effectiveFrom: '2026-01-01', amount: partial.amount }],
    ...partial,
  }
}

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

  it('suma lo que entra y resta lo que sale, en los dos sentidos', () => {
    const transfers = [
      { fromId: coty, toId: maru, amount: 300, period: '2026-11-01' },
      { fromId: maru, toId: coty, amount: 40, period: '2026-11-01' },
      { fromId: maru, toId: coty, amount: 100, period: '2026-11-01' },
      { fromId: coty, toId: maru, amount: 20, period: '2026-11-01' },
    ]
    const effect = loanMonthEffect(coty, '2026-11-01', transfers)
    const card = homeAccountingCard(pocket, effect, 'Maru')

    expect(effect).toMatchObject({ given: 320, received: 140, collected: 0, paid: 0, net: -180 })
    expect(card.lines.find((row) => row.label === 'Maru te pasó')?.amount).toBe(formatMoney(140))
    expect(card.lines.find((row) => row.label === 'Le pasaste a Maru')?.amount).toBe(formatMoney(320))
    expect(card.lines.map((row) => row.amount).slice(2)).toEqual(
      loanEffectLines('Maru', effect).map((row) => formatMoney(row.amount)),
    )
    expect(card.remaining).toBe(870)
    expect(card.remaining).toBe(remainingAfterLoans(pocket.income, pocket.spent, effect.net))
    expect(card.lines.map((row) => row.label)).not.toContain('Préstamos (neto)')
  })

  it('la transferencia cuenta en su período y un mes sin movimientos queda en cero', () => {
    const transfers = [
      { fromId: coty, toId: maru, amount: 200, period: '2026-11-01' },
      { fromId: maru, toId: coty, amount: 80, period: '2026-12-01' },
    ]
    const december = loanMonthEffect(coty, '2026-12-01', transfers)
    const october = loanMonthEffect(coty, '2026-10-01', transfers)
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

  it('separa pocketLines de transferLines', () => {
    const effect = loanMonthEffect(coty, '2026-11-01', [], [])
    const card = homeAccountingCard(pocket, effect, 'Maru')
    expect(card.pocketLines.map((row) => row.label)).toEqual(['Cobraste', 'Gastaste'])
    expect(card.transferLines.map((row) => row.label)).toEqual(['Maru te pasó', 'Le pasaste a Maru'])
    expect(card.lines).toEqual([...card.pocketLines, ...card.transferLines])
  })
})

describe('fijos estimados y margen', () => {
  const month = '2026-11-01'
  const split7525 = { [coty]: 75, [maru]: 25 }

  it('suma un privado abierto entero', () => {
    const total = estimatedOpenFixedTotal({
      fixed: [fixed({ amount: 50_000, isShared: false })],
      meId: coty,
      partnerId: maru,
      splitPercents: split7525,
      month,
    })
    expect(total).toBe(50_000)
  })

  it('de un compartido abierto toma solo mi parte del reparto 75/25', () => {
    const total = estimatedOpenFixedTotal({
      fixed: [fixed({ amount: 100_000, isShared: true })],
      meId: coty,
      partnerId: maru,
      splitPercents: split7525,
      month,
    })
    expect(total).toBe(75_000)
  })

  it('no cuenta un fijo ya pagado', () => {
    const total = estimatedOpenFixedTotal({
      fixed: [
        fixed({
          amount: 40_000,
          isShared: false,
          payment: { id: 'p1' },
        }),
      ],
      meId: coty,
      partnerId: maru,
      splitPercents: split7525,
      month,
    })
    expect(total).toBe(0)
  })

  it('no cuenta un fijo pausado', () => {
    const total = estimatedOpenFixedTotal({
      fixed: [
        fixed({
          amount: 40_000,
          isShared: false,
          pausedAt: '2026-11-01T12:00:00Z',
        }),
      ],
      meId: coty,
      partnerId: maru,
      splitPercents: split7525,
      month,
    })
    expect(total).toBe(0)
  })

  it('no cuenta una cuota fuera de ventana', () => {
    const total = estimatedOpenFixedTotal({
      fixed: [
        fixed({
          amount: 212_265.83,
          isShared: false,
          applies: false,
          hasAmount: false,
          revisions: [{ effectiveFrom: '2026-07-01', amount: 212_265.83 }],
        }),
      ],
      meId: coty,
      partnerId: maru,
      splitPercents: split7525,
      month,
    })
    expect(total).toBe(0)
  })

  it('margen estimado puede ser negativo', () => {
    expect(estimatedMargin(10_000, 40_000)).toBe(-30_000)
    expect(formatMoney(estimatedMargin(10_000, 40_000))).toBe(formatMoney(-30_000))
  })

  it('sin fijos abiertos el estimado es $ 0,00', () => {
    const total = estimatedOpenFixedTotal({
      fixed: [],
      meId: coty,
      partnerId: maru,
      splitPercents: split7525,
      month,
    })
    expect(total).toBe(0)
    expect(estimatedMargin(1_050, 0)).toBe(1_050)
  })
})
