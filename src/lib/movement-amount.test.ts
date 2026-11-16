import { describe, expect, it } from 'vitest'
import { expenseCountsAsOutflow, expenseDisplaySigned, expenseFlowSigned } from './movement-amount.ts'

describe('signo de gastos vs. totales', () => {
  it('siempre muestra el gasto con signo menos', () => {
    expect(expenseDisplaySigned(59_900)).toBe(-59_900)
    expect(expenseDisplaySigned(100)).toBe(-100)
  })

  it('solo cuenta en Salió si lo pagué yo', () => {
    expect(expenseCountsAsOutflow(true)).toBe(true)
    expect(expenseCountsAsOutflow(false)).toBe(false)
    expect(expenseFlowSigned(59_900, true)).toBe(-59_900)
    expect(expenseFlowSigned(59_900, false)).toBeNull()
  })
})
