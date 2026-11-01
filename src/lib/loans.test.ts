import { describe, expect, it } from 'vitest'
import {
  balanceSentence,
  friendlyLoanSummary,
  homeLoanLine,
  loanState,
  matchesLoanFilter,
  pocketIgnoresLoans,
  repaymentRoom,
  sharedLoanNote,
  signedLoanBalance,
} from './loans.ts'

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
    expect(friendlyLoanSummary('Maru', signed)).toBe('Maru te debe $ 200.000,00 en préstamos')
    expect(homeLoanLine(signed)).toBe('Préstamos a cobrar $ 200.000,00')
    expect(homeLoanLine(-80_000)).toBe('Préstamos a devolver $ 80.000,00')
    expect(homeLoanLine(0)).toBeNull()
    expect(friendlyLoanSummary('Coty', -80_000)).toBe('Le debés $ 80.000,00 a Coty')
    expect(friendlyLoanSummary(null, 10)).toBe('Cuando se sume tu compañera, van a poder prestarse.')
    expect(friendlyLoanSummary('Maru', 0)).toBe('No hay préstamos pendientes')
  })

  it('la devolución nueva propone el pendiente y la edición puede usar lo ya anotado', () => {
    expect(repaymentRoom(120_000)).toBe(120_000)
    expect(repaymentRoom(40_000, 80_000)).toBe(120_000)
  })
})

describe('neto de Compartido con préstamos', () => {
  it('resta el saldo de gastos cuando el préstamo queda del otro lado', () => {
    const note = sharedLoanNote('Maru', 280_000, -30_000)
    expect(note?.pendingLine).toBe('Préstamos pendientes: Maru te debe $ 280.000,00')
    expect(note?.netLine).toBe('Maru te debe $ 250.000,00')
    expect(balanceSentence('Coty', -250_000)).toBe('Le debés $ 250.000,00 a Coty')
    expect(sharedLoanNote('Maru', 0, -30_000)).toBeNull()
  })
})

describe('el mes no se mueve', () => {
  it('prestar o devolver no cambia lo que queda ni los gastos', () => {
    const pocket = pocketIgnoresLoans({ base: 900_000, privateSpent: 72_000, myShare: 30_000, extras: 300_000 })
    expect(pocket.remaining).toBe(1_098_000)
    expect(pocket.spent).toBe(102_000)
    expect(pocket.income).toBe(1_200_000)
    expect(pocket.extras).toBe(300_000)
  })
})
