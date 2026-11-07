import { describe, expect, it } from 'vitest'
import { monthPocket } from './derive.ts'
import { formatMoney, normalizeMoney } from './format.ts'
import {
  balanceSentence,
  friendlyLoanSummary,
  formatSignedMoney,
  hasLoanMovement,
  homeLoanLine,
  loanEffectLines,
  loanMonthEffect,
  loanState,
  matchesLoanFilter,
  remainingAfterLoans,
  repaymentRoom,
  settlementPhrases,
  sharedLoanNote,
  sharedSignedBalance,
  signedLoanBalance,
} from './loans.ts'
import { splitByPercents } from './split.ts'

const coty = 'coty'
const maru = 'maru'

describe('estado de un préstamo', () => {
  it('queda pendiente, parcial o saldado según lo devuelto', () => {
    expect(loanState(200_000, 0)).toEqual({ repaid: 0, pending: 200_000, status: 'pendiente' })
    expect(loanState(200_000, 80_000)).toEqual({ repaid: 80_000, pending: 120_000, status: 'parcial' })
    expect(loanState(80_000, 80_000)).toEqual({ repaid: 80_000, pending: 0, status: 'saldado' })
    expect(loanState(200_000.5, 0.5).status).toBe('parcial')
    expect(loanState(200_000.5, 0.5).pending).toBe(200_000)
  })

  it('filtra pendientes con las devoluciones parciales y deja afuera lo saldado', () => {
    expect(matchesLoanFilter('pendiente', 'open')).toBe(true)
    expect(matchesLoanFilter('parcial', 'open')).toBe(true)
    expect(matchesLoanFilter('saldado', 'open')).toBe(false)
    expect(matchesLoanFilter('saldado', 'settled')).toBe(true)
    expect(matchesLoanFilter('parcial', 'all')).toBe(true)
  })

  it('suma solo lo que falta, a favor de quien prestó', () => {
    const signed = signedLoanBalance(coty, [
      { lenderId: coty, borrowerId: maru, pending: 120_000, status: 'parcial' },
      { lenderId: coty, borrowerId: maru, pending: 80_000, status: 'pendiente' },
      { lenderId: coty, borrowerId: maru, pending: 0, status: 'saldado' },
    ])
    expect(signed).toBe(200_000)
    expect(friendlyLoanSummary('Maru', signed)).toBe('Maru tiene que devolver $ 200.000,00')
    expect(homeLoanLine(signed)).toBe('Tiene que devolver $ 200.000,00')
    expect(homeLoanLine(-80_000)).toBe('Tenés que devolver $ 80.000,00')
    expect(homeLoanLine(0)).toBeNull()
    expect(friendlyLoanSummary('Coty', -80_000)).toBe('Tenés que devolver $ 80.000,00')
    expect(friendlyLoanSummary(null, 10)).toBe('Cuando se sume tu compañera, van a poder pasarse plata.')
    expect(friendlyLoanSummary('Maru', 0)).toBe('Están a mano.')
  })

  it('la devolución nueva propone el pendiente y la edición puede usar lo ya anotado', () => {
    expect(repaymentRoom(120_000)).toBe(120_000)
    expect(repaymentRoom(40_000, 80_000)).toBe(120_000)
  })
})

describe('pendiente de devolución, aparte del reparto', () => {
  it('no resta el saldo de gastos del pendiente', () => {
    const note = sharedLoanNote('Maru', 280_000)
    expect(note).toEqual({ pendingLine: 'Maru tiene que devolver $ 280.000,00' })
    expect(note).not.toHaveProperty('netLine')
    expect(balanceSentence('Coty', -250_000)).toBe('Tenés que devolver $ 250.000,00')
    expect(sharedLoanNote('Maru', 0)).toBeNull()
  })
})

describe('frases del paso 3', () => {
  const maruDebe = splitByPercents(
    779_553,
    [
      { id: 'maru', name: 'Maru', percent: 40, paid: 154_900 },
      { id: 'coty', name: 'Coty', percent: 60, paid: 624_653 },
    ],
    false,
  )
  const cotyDebe = splitByPercents(
    779_553,
    [
      { id: 'maru', name: 'Maru', percent: 40, paid: 624_653 },
      { id: 'coty', name: 'Coty', percent: 60, paid: 154_900 },
    ],
    false,
  )
  const aMano = splitByPercents(
    10_000,
    [
      { id: 'coty', name: 'Coty', percent: 60, paid: 6_000 },
      { id: 'maru', name: 'Maru', percent: 40, paid: 4_000 },
    ],
    false,
  )

  it('deja el reparto y el pendiente en frases distintas, también si se cruzan', () => {
    expect(maruDebe.rows.map((row) => row.share)).toEqual([311_821.2, 467_731.8])
    expect(maruDebe.amount).toBe(156_921.2)
    expect(sharedSignedBalance('coty', maruDebe)).toBe(156_921.2)

    const sinPrestamos = settlementPhrases('coty', maruDebe, 0)
    expect(sinPrestamos).toEqual({
      expenseLine: `Maru puso de menos ${formatMoney(maruDebe.amount)}`,
      loanLine: null,
    })

    const conPrestamos = settlementPhrases('coty', maruDebe, 275_000)
    expect(conPrestamos).toEqual({
      expenseLine: `Maru puso de menos ${formatMoney(maruDebe.amount)}`,
      loanLine: `Maru tiene que devolver ${formatMoney(275_000)}`,
    })
    expect(`${conPrestamos.expenseLine} ${conPrestamos.loanLine}`).not.toContain(formatMoney(431_921.2))

    const desdeMaru = settlementPhrases('maru', maruDebe, -275_000)
    expect(desdeMaru).toEqual({
      expenseLine: `Coty puso de más ${formatMoney(maruDebe.amount)}`,
      loanLine: `Tenés que devolver ${formatMoney(275_000)}`,
    })
    expect(`${desdeMaru.expenseLine} ${desdeMaru.loanLine}`).not.toContain(formatMoney(431_921.2))

    const cruzado = settlementPhrases('coty', maruDebe, -275_000)
    expect(cruzado).toEqual({
      expenseLine: `Maru puso de menos ${formatMoney(maruDebe.amount)}`,
      loanLine: `Tenés que devolver ${formatMoney(275_000)}`,
    })
    expect(`${cruzado.expenseLine} ${cruzado.loanLine}`).not.toContain(formatMoney(118_078.8))
  })

  it('invierte la frase cuando Coty debe, con y sin préstamos', () => {
    expect(cotyDebe.debtorId).toBe('coty')
    expect(cotyDebe.creditorId).toBe('maru')
    const deudora = cotyDebe.rows.find((row) => row.id === 'coty')
    expect(deudora).toBeTruthy()
    const owed = formatMoney(cotyDebe.amount)

    const sinPrestamos = settlementPhrases('maru', cotyDebe, 0)
    expect(sinPrestamos).toEqual({
      expenseLine: `Coty puso de menos ${owed}`,
      loanLine: null,
    })
    expect(deudora?.paid).toBe(154_900)

    const conPrestamos = settlementPhrases('maru', cotyDebe, 80_000)
    expect(conPrestamos).toEqual({
      expenseLine: `Coty puso de menos ${owed}`,
      loanLine: `Coty tiene que devolver ${formatMoney(80_000)}`,
    })
    expect(`${conPrestamos.expenseLine} ${conPrestamos.loanLine}`).not.toContain(
      formatMoney(normalizeMoney(sharedSignedBalance('maru', cotyDebe) + 80_000)),
    )

    const desdeCoty = settlementPhrases('coty', cotyDebe, -80_000)
    expect(desdeCoty).toEqual({
      expenseLine: `Maru puso de más ${owed}`,
      loanLine: `Tenés que devolver ${formatMoney(80_000)}`,
    })
    expect(`${desdeCoty.expenseLine} ${desdeCoty.loanLine}`).not.toContain(
      formatMoney(normalizeMoney(Math.abs(sharedSignedBalance('coty', cotyDebe) - 80_000))),
    )
  })

  it('deja el reparto en cero y el pendiente en su propia frase', () => {
    expect(aMano.amount).toBe(0)
    const sinPrestamos = settlementPhrases('coty', aMano, 0)
    expect(sinPrestamos).toEqual({ expenseLine: 'Están a mano este mes.', loanLine: null })
    expect(settlementPhrases('maru', aMano, 0)).toEqual({ expenseLine: 'Están a mano este mes.', loanLine: null })

    const conPrestamos = settlementPhrases('coty', aMano, 275_000)
    expect(conPrestamos).toEqual({
      expenseLine: 'Están a mano este mes.',
      loanLine: balanceSentence('Maru', 275_000),
    })
    expect(conPrestamos.expenseLine).not.toContain('275.000')
    expect(settlementPhrases('maru', aMano, -275_000)).toEqual({
      expenseLine: 'Están a mano este mes.',
      loanLine: 'Tenés que devolver $ 275.000,00',
    })
  })
})

describe('transferencias en Te quedan', () => {
  const loans = [{ lenderId: coty, borrowerId: maru, amount: 200_000, period: '2026-11-01' }]
  const repayments = [{ lenderId: coty, borrowerId: maru, amount: 80_000, period: '2026-12-01' }]
  const pocket = monthPocket({ base: 900_000, privateSpent: 72_000, sharedPaid: 30_000, extras: 300_000 })

  it('resta al que presta y suma al que recibe, cada uno en el período que le toca', () => {
    const novemberLender = loanMonthEffect(coty, '2026-11-01', loans, repayments)
    const novemberBorrower = loanMonthEffect(maru, '2026-11-01', loans, repayments)
    expect(novemberLender).toEqual({ given: 200_000, collected: 0, received: 0, paid: 0, net: -200_000 })
    expect(novemberBorrower).toEqual({ given: 0, collected: 0, received: 200_000, paid: 0, net: 200_000 })
    expect(remainingAfterLoans(pocket.income, pocket.spent, novemberLender.net)).toBe(898_000)
    expect(remainingAfterLoans(pocket.income, pocket.spent, novemberBorrower.net)).toBe(1_298_000)

    const decemberLender = loanMonthEffect(coty, '2026-12-01', loans, repayments)
    const decemberBorrower = loanMonthEffect(maru, '2026-12-01', loans, repayments)
    expect(decemberLender).toEqual({ given: 0, collected: 80_000, received: 0, paid: 0, net: 80_000 })
    expect(decemberBorrower).toEqual({ given: 0, collected: 0, received: 0, paid: 80_000, net: -80_000 })
    expect(remainingAfterLoans(pocket.income, pocket.spent, decemberLender.net)).toBe(1_178_000)
    expect(remainingAfterLoans(pocket.income, pocket.spent, decemberBorrower.net)).toBe(1_018_000)
  })

  it('no cambia ingresos ni gastos del mes', () => {
    expect(pocket.income).toBe(1_200_000)
    expect(pocket.spent).toBe(102_000)
    expect(pocket.remaining).toBe(1_098_000)
    const effect = loanMonthEffect(coty, '2026-11-01', loans, repayments)
    expect(hasLoanMovement(effect)).toBe(true)
    expect(loanEffectLines('Maru', effect)).toEqual([
      { label: 'Maru te pasó', amount: 0 },
      { label: 'Le pasaste a Maru', amount: 200_000 },
    ])
    expect(formatSignedMoney(effect.net)).toBe('-$ 200.000,00')
    expect(formatSignedMoney(80_000)).toBe('+$ 80.000,00')
    expect(loanMonthEffect(coty, '2026-10-01', loans, repayments).net).toBe(0)
    expect(hasLoanMovement(loanMonthEffect(coty, '2026-10-01', loans, repayments))).toBe(false)
  })
})
