import { beforeEach, describe, expect, it, vi } from 'vitest'
import { undoFixedPayment, type FixedPayment } from './api.ts'

const state = vi.hoisted(() => ({
  failExpense: false,
  calls: [] as string[],
}))

vi.mock('./supabase.ts', () => ({
  supabase: {
    from: (table: string) => ({
      delete: () => ({
        eq: async () => {
          state.calls.push(table)
          if (table === 'expenses' && state.failExpense) {
            return { error: { message: 'Ese mes ya está saldado. Deshacé el saldo en Compartidos para cambiar este gasto.' } }
          }
          return { error: null }
        },
      }),
    }),
  },
  supabaseConfigError: null,
}))

const payment: FixedPayment = {
  id: 'pago',
  paidOn: '2026-10-05',
  payerId: 'coty',
  amount: 1000,
  expenseId: 'gasto',
}

describe('deshacer un pago fijo', () => {
  beforeEach(() => {
    state.failExpense = false
    state.calls = []
  })

  it('borra el gasto antes que el pago', async () => {
    await undoFixedPayment(payment)
    expect(state.calls).toEqual(['expenses', 'fixed_payments'])
  })

  it('si el gasto no se puede borrar, el pago queda', async () => {
    state.failExpense = true
    await expect(undoFixedPayment(payment)).rejects.toThrow(/saldado/)
    expect(state.calls).toEqual(['expenses'])
  })

  it('sin gasto asociado solo borra el pago', async () => {
    await undoFixedPayment({ ...payment, expenseId: null })
    expect(state.calls).toEqual(['fixed_payments'])
  })
})
