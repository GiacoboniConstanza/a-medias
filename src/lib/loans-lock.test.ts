import { describe, expect, it } from 'vitest'
import { monthIsSettled, repaymentIsLocked } from './loans.ts'

const settled = ['2026-10-01']

describe('bloqueo de devoluciones', () => {
  it('un mes saldado queda cerrado y uno abierto no', () => {
    expect(monthIsSettled('2026-10-01', settled)).toBe(true)
    expect(monthIsSettled('2026-11-01', settled)).toBe(false)
  })

  it('una devolución de saldo o de un mes saldado no se edita, y una de un mes abierto sí', () => {
    expect(repaymentIsLocked({ settlementId: 'saldo', period: '2026-11-01' }, settled)).toBe(true)
    expect(repaymentIsLocked({ settlementId: null, period: '2026-10-01' }, settled)).toBe(true)
    expect(repaymentIsLocked({ settlementId: null, period: '2026-11-01' }, settled)).toBe(false)
  })
})
