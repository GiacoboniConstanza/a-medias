import { describe, expect, it } from 'vitest'
import { paidHalfCaption, pairBalance, shareAmounts, sharedHalf, splitByPercents } from './split.ts'

const owed = splitByPercents(
  25_000,
  [
    { id: 'coty', name: 'Coty', percent: 50, paid: 25_000 },
    { id: 'maru', name: 'Maru', percent: 50, paid: 0 },
  ],
  false,
)

describe('saldo compartido', () => {
  it('arma la frase y lo pagado de cada una con el mismo reparto', () => {
    expect(pairBalance('coty', owed)).toEqual({
      even: false,
      sentence: 'Maru te debe $ 12.500,00',
      myPaid: 25_000,
      partnerPaid: 0,
      partnerName: 'Maru',
    })
    expect(pairBalance('maru', owed).sentence).toBe('Le debés $ 12.500,00 a Coty')
  })

  it('dice que están a mano cuando el saldo es cero', () => {
    const even = splitByPercents(
      10_000,
      [
        { id: 'coty', name: 'Coty', percent: 60, paid: 6_000 },
        { id: 'maru', name: 'Maru', percent: 40, paid: 4_000 },
      ],
      false,
    )
    expect(pairBalance('maru', even).even).toBe(true)
    expect(pairBalance('maru', even).sentence).toBe('Están a mano')
    expect(pairBalance('maru', even).myPaid).toBe(4_000)
    expect(pairBalance('maru', even).partnerName).toBe('Coty')
  })
})

describe('mitad de un gasto', () => {
  it('parte el monto con el mismo redondeo del reparto', () => {
    expect(sharedHalf(12_500)).toBe(6_250)
    expect(sharedHalf(12_501)).toBe(6_250.5)
    expect(paidHalfCaption('Coty', 12_500)).toBe('Pagó Coty, mitad: $ 6.250,00')
  })

  it('deja el centavo impar en quien pagó', () => {
    expect(sharedHalf(10.01)).toBe(5.01)
    expect(shareAmounts(10.01, [1, 1])).toEqual([5, 5.01])
    expect(paidHalfCaption('Coty', 10.01)).toBe('Pagó Coty, mitad: $ 5,01')
  })
})
