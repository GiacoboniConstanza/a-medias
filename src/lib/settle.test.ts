import { describe, expect, it } from 'vitest'
import { monthPocket } from './derive.ts'
import { loanMonthEffect, remainingAfterLoans } from './transfers.ts'
import { passPhrase, planMonthSettlement } from './settle.ts'
import { splitByPercents, type SplitResult } from './split.ts'

const coty = 'coty'
const maru = 'maru'

const maruDebe = splitByPercents(
  779_553,
  [
    { id: maru, name: 'Maru', percent: 40, paid: 154_900 },
    { id: coty, name: 'Coty', percent: 60, paid: 624_653 },
  ],
  false,
)

const aMano = splitByPercents(
  10_000,
  [
    { id: coty, name: 'Coty', percent: 60, paid: 6_000 },
    { id: maru, name: 'Maru', percent: 40, paid: 4_000 },
  ],
  false,
)

const pocket = monthPocket({ base: 900_000, privateSpent: 72_000, sharedPaid: 30_000, extras: 300_000 })

describe('saldar el mes', () => {
  it('saldar arma el neto solo con el reparto de gastos', () => {
    const plan = planMonthSettlement({
      month: '2026-11-01',
      meId: coty,
      partnerId: maru,
      split: maruDebe,
      alreadySettled: false,
    })
    expect(plan.expenseAmount).toBe(156_921.2)
    expect(plan.debtorId).toBe(maru)
    expect(plan.creditorId).toBe(coty)
    expect(plan.amount).toBe(156_921.2)
    expect(plan.canSettle).toBe(true)
    expect(plan.expenseDebtorId).toBe(maru)
  })

  it('a mano no se puede saldar', () => {
    const plan = planMonthSettlement({
      month: '2026-11-01',
      meId: coty,
      partnerId: maru,
      split: aMano,
      alreadySettled: false,
    })
    expect(plan.amount).toBe(0)
    expect(plan.canSettle).toBe(false)
    expect(plan.blockedReason).toBe('No hay nada para saldar este mes.')
  })

  it('no se puede saldar dos veces', () => {
    const plan = planMonthSettlement({
      month: '2026-11-01',
      meId: coty,
      partnerId: maru,
      split: maruDebe,
      alreadySettled: true,
    })
    expect(plan.canSettle).toBe(false)
    expect(plan.amount).toBe(156_921.2)
  })

  it('cierra centavos impares del reparto', () => {
    const odd: SplitResult = {
      total: 0.03,
      rows: [],
      debtorId: coty,
      creditorId: maru,
      amount: 0.02,
      usedEvenSplit: false,
    }
    const plan = planMonthSettlement({
      month: '2026-11-01',
      meId: coty,
      partnerId: maru,
      split: odd,
      alreadySettled: false,
    })
    expect(plan.amount).toBe(0.02)
    expect(plan.creditorId).toBe(maru)
    expect(plan.debtorId).toBe(coty)
    expect(passPhrase('Maru', false, plan.amount)).toBe('Le pasás $ 0,02 a Maru')
    expect(passPhrase('Coty', true, plan.amount)).toBe('Coty te pasa $ 0,02')
  })

  it('el reparto no mueve Te quedan; las transferencias sí', () => {
    const cash = monthPocket({ base: 1_000, privateSpent: 0, sharedPaid: 100, extras: 0 })
    expect(cash.spent).toBe(100)
    expect(cash.remaining).toBe(900)
    const plan = planMonthSettlement({
      month: '2026-11-01',
      meId: coty,
      partnerId: maru,
      split: maruDebe,
      alreadySettled: false,
    })
    expect(plan.expenseAmount).toBe(156_921.2)
    expect(plan.amount).toBe(156_921.2)
    const before = loanMonthEffect(coty, '2026-11-01', [])
    expect(remainingAfterLoans(cash.income, cash.spent, before.net)).toBe(900)
    // Transferencia migrada desde un préstamo viejo: mueve Te quedan, no el saldo.
    const after = loanMonthEffect(coty, '2026-11-01', [
      { fromId: coty, toId: maru, amount: 300, period: '2026-11-01' },
    ])
    expect(after.given).toBe(300)
    expect(remainingAfterLoans(cash.income, cash.spent, after.net)).toBe(600)
    expect(remainingAfterLoans(cash.income, cash.spent, after.net)).not.toBe(900 - plan.expenseAmount)
    expect(remainingAfterLoans(pocket.income, pocket.spent, before.net)).toBe(1_098_000)
  })
})
