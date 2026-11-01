import { describe, expect, it } from 'vitest'
import { expenseSpan } from './expense-range.ts'
import { filterByScopeAndCategory, filterReminders, matchesPaid, matchesScope } from './finance-filters.ts'

describe('alcance', () => {
  it('deja pasar todos, o solo compartidos, o solo privados', () => {
    expect(matchesScope(true, 'all')).toBe(true)
    expect(matchesScope(false, 'all')).toBe(true)
    expect(matchesScope(true, 'shared')).toBe(true)
    expect(matchesScope(false, 'shared')).toBe(false)
    expect(matchesScope(true, 'private')).toBe(false)
    expect(matchesScope(false, 'private')).toBe(true)
  })
})

describe('estado de avisos', () => {
  it('filtra pendiente y pagado', () => {
    expect(matchesPaid(false, 'all')).toBe(true)
    expect(matchesPaid(true, 'pending')).toBe(false)
    expect(matchesPaid(false, 'pending')).toBe(true)
    expect(matchesPaid(true, 'paid')).toBe(true)
  })
})

describe('listas', () => {
  const items = [
    { id: 'a', isShared: true, categoryId: 'super' },
    { id: 'b', isShared: false, categoryId: 'cafe' },
    { id: 'c', isShared: true, categoryId: 'luz' },
  ]

  it('combina alcance y categoría', () => {
    expect(filterByScopeAndCategory(items, { scope: 'shared', categoryIds: ['super'] }).map((item) => item.id)).toEqual(['a'])
    expect(filterByScopeAndCategory(items, { scope: 'all', categoryIds: [] }).map((item) => item.id)).toEqual(['a', 'b', 'c'])
    expect(filterByScopeAndCategory(items, { scope: 'private', categoryIds: [] }).map((item) => item.id)).toEqual(['b'])
  })
})

describe('avisos', () => {
  const month = '2026-10-01'
  const items = [
    { id: 'luz', isShared: true, categoryId: 'serv', dueDay: 5, payment: { id: 'p1' } },
    { id: 'net', isShared: true, categoryId: 'serv', dueDay: 12, payment: null },
    { id: 'gym', isShared: false, categoryId: 'salud', dueDay: 20, payment: null },
  ]

  it('filtra por alcance, categoría, estado y semana', () => {
    const week3 = expenseSpan(month, 'week3', '', '')
    expect(
      filterReminders(items, { scope: 'shared', categoryIds: [], paid: 'pending' }, month, week3, 'week3').map((item) => item.id),
    ).toEqual(['net'])
    expect(
      filterReminders(items, { scope: 'all', categoryIds: ['salud'], paid: 'all' }, month, expenseSpan(month, 'month', '', ''), 'month').map(
        (item) => item.id,
      ),
    ).toEqual(['gym'])
    expect(
      filterReminders(items, { scope: 'shared', categoryIds: [], paid: 'paid' }, month, expenseSpan(month, 'month', '', ''), 'month').map(
        (item) => item.id,
      ),
    ).toEqual(['luz'])
  })
})
