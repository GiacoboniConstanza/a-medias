import { describe, expect, it } from 'vitest'
import { monthPocket } from './derive.ts'
import { formatMoney } from './format.ts'
import { loanMonthEffect, remainingAfterLoans, type PeriodLoan, type PeriodRepayment } from './loans.ts'
import {
  linkedLoanAmount,
  loansInSettlement,
  passPhrase,
  planMonthSettlement,
  returnSentences,
  withoutSettlementRepayments,
  type SettleLoan,
  type TaggedRepayment,
} from './settle.ts'
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

function loan(id: string, lenderId: string, borrowerId: string, pending: number, period: string): SettleLoan {
  return { id, lenderId, borrowerId, pending, period }
}

function asMovements(rows: readonly { lenderId: string; borrowerId: string; amount: number; period: string }[]): PeriodRepayment[] {
  return rows.map((row) => ({
    lenderId: row.lenderId,
    borrowerId: row.borrowerId,
    amount: row.amount,
    period: row.period,
  }))
}

describe('saldar el mes', () => {
  const abierto = [
    loan('oct', coty, maru, 275_000, '2026-10-01'),
    loan('nov', maru, coty, 80_000, '2026-11-01'),
    loan('dic', coty, maru, 40_000, '2026-12-01'),
  ]

  it('saldar con gastos y préstamos arma una devolución por el pendiente entero', () => {
    const plan = planMonthSettlement({
      month: '2026-11-01',
      meId: coty,
      partnerId: maru,
      split: maruDebe,
      loans: abierto,
      alreadySettled: false,
    })
    expect(plan.expenseAmount).toBe(156_921.2)
    expect(plan.loanAmount).toBe(195_000)
    expect(plan.repayments.map((row) => [row.loanId, row.amount])).toEqual([
      ['oct', 275_000],
      ['nov', 80_000],
    ])
    expect(plan.debtorId).toBe(maru)
    expect(plan.creditorId).toBe(coty)
    expect(plan.amount).toBe(351_921.2)
    expect(plan.canSettle).toBe(true)
    expect(plan.expenseDebtorId).toBe(maru)
    expect(returnSentences(coty, 'Maru', plan.repayments)).toBe(
      `Maru devuelve ${formatMoney(275_000)}. Devolvés ${formatMoney(80_000)}`,
    )
  })

  it('la devolución queda en el período del mes saldado', () => {
    const plan = planMonthSettlement({
      month: '2026-11-01',
      meId: coty,
      partnerId: maru,
      split: aMano,
      loans: [loan('oct', coty, maru, 275_000, '2026-10-01')],
      alreadySettled: false,
    })
    expect(plan.repayments).toEqual([
      {
        loanId: 'oct',
        lenderId: coty,
        borrowerId: maru,
        amount: 275_000,
        paidOn: '2026-11-30',
        period: '2026-11-01',
      },
    ])
  })

  it('préstamo de un mes anterior entra', () => {
    const included = loansInSettlement('2026-11-01', coty, maru, abierto)
    expect(included.map((row) => row.id)).toEqual(['oct', 'nov'])
    const plan = planMonthSettlement({
      month: '2026-11-01',
      meId: maru,
      partnerId: coty,
      split: aMano,
      loans: [loan('oct', coty, maru, 50, '2026-10-15')],
      alreadySettled: false,
    })
    expect(plan.repayments[0]?.period).toBe('2026-11-01')
    expect(plan.repayments[0]?.paidOn).toBe('2026-11-30')
    expect(plan.repayments[0]?.amount).toBe(50)
    expect(plan.debtorId).toBe(maru)
    expect(plan.creditorId).toBe(coty)
  })

  it('préstamo de un mes posterior queda afuera', () => {
    const plan = planMonthSettlement({
      month: '2026-11-01',
      meId: coty,
      partnerId: maru,
      split: aMano,
      loans: [loan('dic', coty, maru, 40_000, '2026-12-01')],
      alreadySettled: false,
    })
    expect(plan.repayments).toEqual([])
    expect(plan.loanAmount).toBe(0)
    expect(plan.canSettle).toBe(false)
    expect(plan.blockedReason).toBe('No hay nada para saldar este mes.')
  })

  it('Me queda de las dos antes, después y al deshacer', () => {
    const given: PeriodLoan[] = [
      { lenderId: coty, borrowerId: maru, amount: 275_000, period: '2026-10-01' },
      { lenderId: maru, borrowerId: coty, amount: 80_000, period: '2026-11-01' },
    ]
    const plan = planMonthSettlement({
      month: '2026-11-01',
      meId: coty,
      partnerId: maru,
      split: aMano,
      loans: [
        loan('oct', coty, maru, 275_000, '2026-10-01'),
        loan('nov', maru, coty, 80_000, '2026-11-01'),
      ],
      alreadySettled: false,
    })
    const generated = asMovements(plan.repayments)
    const beforeCoty = loanMonthEffect(coty, '2026-11-01', given, [])
    const beforeMaru = loanMonthEffect(maru, '2026-11-01', given, [])
    expect(beforeCoty.net).toBe(80_000)
    expect(beforeMaru.net).toBe(-80_000)
    expect(remainingAfterLoans(pocket.income, pocket.spent, beforeCoty.net)).toBe(1_178_000)
    expect(remainingAfterLoans(pocket.income, pocket.spent, beforeMaru.net)).toBe(1_018_000)

    const afterCoty = loanMonthEffect(coty, '2026-11-01', given, generated)
    const afterMaru = loanMonthEffect(maru, '2026-11-01', given, generated)
    expect(afterCoty).toMatchObject({ collected: 275_000, paid: 80_000, net: 275_000 })
    expect(afterMaru).toMatchObject({ collected: 80_000, paid: 275_000, net: -275_000 })
    expect(remainingAfterLoans(pocket.income, pocket.spent, afterCoty.net)).toBe(1_373_000)
    expect(remainingAfterLoans(pocket.income, pocket.spent, afterMaru.net)).toBe(823_000)
    expect(loanMonthEffect(coty, '2026-10-01', given, generated).net).toBe(-275_000)

    const undone = loanMonthEffect(coty, '2026-11-01', given, [])
    expect(remainingAfterLoans(pocket.income, pocket.spent, undone.net)).toBe(
      remainingAfterLoans(pocket.income, pocket.spent, beforeCoty.net),
    )
  })

  it('no se puede saldar dos veces', () => {
    const plan = planMonthSettlement({
      month: '2026-11-01',
      meId: coty,
      partnerId: maru,
      split: maruDebe,
      loans: abierto,
      alreadySettled: true,
    })
    expect(plan.canSettle).toBe(false)
    expect(plan.amount).toBe(351_921.2)
  })

  it('deshacer no toca las devoluciones cargadas a mano', () => {
    const rows: TaggedRepayment[] = [
      { lenderId: coty, borrowerId: maru, amount: 20, period: '2026-11-01', settlementId: null },
      { lenderId: coty, borrowerId: maru, amount: 80, period: '2026-11-01', settlementId: 'saldo-nov' },
      { lenderId: maru, borrowerId: coty, amount: 15, period: '2026-12-01', settlementId: 'saldo-dic' },
    ]
    const left = withoutSettlementRepayments(rows, 'saldo-nov')
    expect(left).toEqual([rows[0], rows[2]])
    const given: PeriodLoan[] = [{ lenderId: coty, borrowerId: maru, amount: 100, period: '2026-11-01' }]
    const beforeUndo = loanMonthEffect(coty, '2026-11-01', given, asMovements(rows.filter((row) => row.period === '2026-11-01')))
    const afterUndo = loanMonthEffect(coty, '2026-11-01', given, asMovements(left))
    expect(beforeUndo.collected).toBe(100)
    expect(afterUndo.collected).toBe(20)
    expect(afterUndo.net).toBe(-80)
  })

  it('cierra centavos impares sin redondear el pendiente', () => {
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
      loans: [loan('cent', coty, maru, 10.01, '2026-10-01')],
      alreadySettled: false,
    })
    expect(plan.repayments[0]?.amount).toBe(10.01)
    expect(plan.amount).toBe(9.99)
    expect(plan.creditorId).toBe(coty)
    expect(plan.debtorId).toBe(maru)
    expect(linkedLoanAmount(plan.repayments)).toBe(10.01)
    expect(passPhrase('Maru', true, plan.amount)).toBe('Maru te pasa $ 9,99')
    expect(passPhrase('Coty', false, plan.amount)).toBe('Le pasás $ 9,99 a Coty')
    expect(returnSentences(coty, 'Maru', plan.repayments)).toBe(`Maru devuelve ${formatMoney(10.01)}`)
  })

  it('el reparto no mueve Te quedan y las devoluciones del saldo sí', () => {
    const cash = monthPocket({ base: 1_000, privateSpent: 0, sharedPaid: 100, extras: 0 })
    expect(cash.spent).toBe(100)
    expect(cash.remaining).toBe(900)
    const plan = planMonthSettlement({
      month: '2026-11-01',
      meId: coty,
      partnerId: maru,
      split: maruDebe,
      loans: [loan('oct', coty, maru, 300, '2026-10-01')],
      alreadySettled: false,
    })
    expect(plan.expenseAmount).toBe(156_921.2)
    expect(plan.loanAmount).toBe(300)
    expect(plan.amount).toBe(157_221.2)
    const before = loanMonthEffect(coty, '2026-11-01', [], [])
    expect(remainingAfterLoans(cash.income, cash.spent, before.net)).toBe(900)
    const after = loanMonthEffect(coty, '2026-11-01', [], asMovements(plan.repayments))
    expect(after.collected).toBe(300)
    expect(remainingAfterLoans(cash.income, cash.spent, after.net)).toBe(1_200)
    expect(remainingAfterLoans(cash.income, cash.spent, after.net)).not.toBe(900 + plan.expenseAmount)
  })
})
