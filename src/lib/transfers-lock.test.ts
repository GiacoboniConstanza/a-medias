import { describe, expect, it } from 'vitest'
import { monthIsSettled } from './transfers.ts'

const settled = ['2026-10-01']

describe('mes saldado', () => {
  it('un mes saldado queda cerrado y uno abierto no', () => {
    expect(monthIsSettled('2026-10-01', settled)).toBe(true)
    expect(monthIsSettled('2026-11-01', settled)).toBe(false)
  })
})
