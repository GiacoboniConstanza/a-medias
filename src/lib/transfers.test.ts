import { describe, expect, it } from 'vitest'
import { monthPocket } from './derive.ts'
import {
  formatSignedMoney,
  hasLoanMovement,
  loanEffectLines,
  loanMonthEffect,
  remainingAfterLoans,
  sharedSignedBalance,
} from './transfers.ts'
import { splitByPercents } from './split.ts'

const coty = 'coty'
const maru = 'maru'

describe('saldo compartido firmado', () => {
  it('es positivo si te deben y negativo si debés', () => {
    const maruDebe = splitByPercents(
      779_553,
      [
        { id: 'maru', name: 'Maru', percent: 40, paid: 154_900 },
        { id: 'coty', name: 'Coty', percent: 60, paid: 624_653 },
      ],
      false,
    )
    expect(sharedSignedBalance('coty', maruDebe)).toBe(156_921.2)
    expect(sharedSignedBalance('maru', maruDebe)).toBe(-156_921.2)
  })
})

describe('transferencias en Te quedan', () => {
  // Préstamo migrado + su devolución migrada como transferencia al revés.
  const transfers = [
    { fromId: coty, toId: maru, amount: 200_000, period: '2026-11-01' },
    { fromId: maru, toId: coty, amount: 80_000, period: '2026-12-01' },
  ]
  const pocket = monthPocket({ base: 900_000, privateSpent: 72_000, sharedPaid: 30_000, extras: 300_000 })

  it('resta al que manda y suma al que recibe, cada uno en el período que le toca', () => {
    const novemberSender = loanMonthEffect(coty, '2026-11-01', transfers)
    const novemberReceiver = loanMonthEffect(maru, '2026-11-01', transfers)
    expect(novemberSender).toEqual({ given: 200_000, collected: 0, received: 0, paid: 0, net: -200_000 })
    expect(novemberReceiver).toEqual({ given: 0, collected: 0, received: 200_000, paid: 0, net: 200_000 })
    expect(remainingAfterLoans(pocket.income, pocket.spent, novemberSender.net)).toBe(898_000)
    expect(remainingAfterLoans(pocket.income, pocket.spent, novemberReceiver.net)).toBe(1_298_000)

    const decemberReceiver = loanMonthEffect(coty, '2026-12-01', transfers)
    const decemberSender = loanMonthEffect(maru, '2026-12-01', transfers)
    expect(decemberReceiver).toEqual({ given: 0, collected: 0, received: 80_000, paid: 0, net: 80_000 })
    expect(decemberSender).toEqual({ given: 80_000, collected: 0, received: 0, paid: 0, net: -80_000 })
    expect(remainingAfterLoans(pocket.income, pocket.spent, decemberReceiver.net)).toBe(1_178_000)
    expect(remainingAfterLoans(pocket.income, pocket.spent, decemberSender.net)).toBe(1_018_000)
  })

  it('no cambia ingresos ni gastos del mes', () => {
    expect(pocket.income).toBe(1_200_000)
    expect(pocket.spent).toBe(102_000)
    expect(pocket.remaining).toBe(1_098_000)
    const effect = loanMonthEffect(coty, '2026-11-01', transfers)
    expect(hasLoanMovement(effect)).toBe(true)
    expect(loanEffectLines('Maru', effect)).toEqual([
      { label: 'Maru te pasó', amount: 0 },
      { label: 'Le pasaste a Maru', amount: 200_000 },
    ])
    expect(formatSignedMoney(effect.net)).toBe('-$ 200.000,00')
    expect(formatSignedMoney(80_000)).toBe('+$ 80.000,00')
    expect(loanMonthEffect(coty, '2026-10-01', transfers).net).toBe(0)
    expect(hasLoanMovement(loanMonthEffect(coty, '2026-10-01', transfers))).toBe(false)
  })
})
