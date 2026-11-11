import { describe, expect, it } from 'vitest'
import { withoutBagExpenses, type ExpenseItem } from './api.ts'

function expense(partial: Partial<ExpenseItem> & Pick<ExpenseItem, 'id' | 'paidFromBag'>): ExpenseItem {
  return {
    title: null,
    amount: 100,
    spentOn: '2026-11-10',
    period: '2026-11-01',
    isShared: false,
    payerId: 'me',
    ownerId: 'me',
    categoryId: null,
    notes: null,
    ...partial,
  }
}

describe('gastos de la bolsa', () => {
  it('excluye paidFromBag de la lista visible', () => {
    const rows = withoutBagExpenses([
      expense({ id: 'a', paidFromBag: false, amount: 20 }),
      expense({ id: 'b', paidFromBag: true, amount: 40 }),
      expense({ id: 'c', paidFromBag: false, amount: 10 }),
    ])
    expect(rows.map((row) => row.id)).toEqual(['a', 'c'])
    expect(rows.reduce((sum, row) => sum + row.amount, 0)).toBe(30)
  })
})
