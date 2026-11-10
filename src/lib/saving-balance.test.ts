import { describe, expect, it } from 'vitest'
import { savingBalances, withdrawableByUser } from './saving-balance.ts'

describe('saldo de un ahorro', () => {
  it('suma inicial + aportes − retiros, total y por persona', () => {
    const balances = savingBalances(
      [
        { userId: 'coty', amount: 200_000 },
        { userId: 'maru', amount: 150_000 },
      ],
      [
        { userId: 'maru', kind: 'aporte', amount: 40_000 },
        { userId: 'coty', kind: 'aporte', amount: 50_000 },
        { userId: 'coty', kind: 'retiro', amount: 10_000 },
      ],
    )
    expect(balances.byUser.coty).toBe(240_000)
    expect(balances.byUser.maru).toBe(190_000)
    expect(balances.total).toBe(430_000)
  })

  it('sin movimientos queda solo el saldo inicial', () => {
    expect(savingBalances([{ userId: 'coty', amount: 300_000 }], []).total).toBe(300_000)
  })
})

describe('cuánto puede retirar cada una', () => {
  it('en un compartido cada una retira hasta lo suyo', () => {
    const balances = savingBalances(
      [
        { userId: 'coty', amount: 200_000 },
        { userId: 'maru', amount: 150_000 },
      ],
      [{ userId: 'coty', kind: 'aporte', amount: 50_000 }],
    )
    expect(withdrawableByUser(balances, 'coty')).toBe(250_000)
    expect(withdrawableByUser(balances, 'maru')).toBe(150_000)
  })

  it('sin saldo propio no puede retirar', () => {
    expect(withdrawableByUser({ total: 100, byUser: { coty: 100 } }, 'maru')).toBe(0)
  })
})
