import { describe, expect, it } from 'vitest'
import type { FinanceData } from './api.ts'
import { bagBalances, monthBagSplit } from './bag.ts'
import { myPrivateSpent } from './derive.ts'

describe('saldos de la bolsa', () => {
  it('deja en gustos lo que no fue a un fondo y descuenta gustos y pases', () => {
    const balance = bagBalances(
      [
        { fundId: null, amount: 100 },
        { fundId: 'viaje', amount: 40 },
      ],
      [
        { kind: 'gusto', fundId: null, amount: 25 },
        { kind: 'to_fund', fundId: 'viaje', amount: 30 },
        { kind: 'to_gustos', fundId: 'viaje', amount: 10 },
        { kind: 'use', fundId: 'viaje', amount: 5 },
      ],
    )
    expect(balance.gustosPool).toBe(110)
    expect(balance.gustosFree).toBe(55)
    expect(balance.savedByFund.get('viaje')).toBe(40 + 30 - 10 - 5)
  })

  it('cuenta el extra sin repartir como gustos del mes', () => {
    const split = monthBagSplit([
      { amount: 80, parts: [{ amount: 50, toGustos: false }] },
      { amount: 20, parts: [{ amount: 20, toGustos: true }] },
    ])
    expect(split.total).toBe(100)
    expect(split.funds).toBe(50)
    expect(split.gustos).toBe(50)
  })
})

describe('me queda', () => {
  it('no descuenta lo pagado con la bolsa', () => {
    const data = {
      monthExpenses: [
        { isShared: false, paidFromBag: true, ownerId: 'me', amount: 40 },
        { isShared: false, paidFromBag: false, ownerId: 'me', amount: 15 },
        { isShared: true, paidFromBag: false, ownerId: 'me', amount: 90 },
      ],
    } as FinanceData
    expect(myPrivateSpent(data, 'me')).toBe(15)
  })
})
