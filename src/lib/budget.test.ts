import { describe, expect, it } from 'vitest'
import {
  budgetAriaLabel,
  budgetOrder,
  budgetPercent,
  budgetRowsForMonth,
  budgetShare,
  budgetSpent,
  budgetState,
  budgetStatusLine,
} from './budget.ts'
import type { ExpenseItem, FinanceData } from './api.ts'

const me = 'coty'
const partner = 'maru'

function expense(partial: Partial<ExpenseItem> & Pick<ExpenseItem, 'id' | 'amount' | 'isShared' | 'ownerId'>): ExpenseItem {
  return {
    title: null,
    spentOn: '2026-11-10',
    period: '2026-11-01',
    paidFromBag: false,
    payerId: partial.ownerId,
    categoryId: 'cat-super',
    notes: null,
    mpOperationId: null,
    ...partial,
  }
}

function data(expenses: ExpenseItem[], splitEven = false, myPercent = 60): FinanceData {
  return {
    inviteCode: 'X',
    names: { [me]: 'Coty', [partner]: 'Maru' },
    bases: { [me]: 900000, [partner]: 600000 },
    splitPercents: { [me]: myPercent, [partner]: 100 - myPercent },
    splitEven,
    splitNotice: null,
    settlement: null,
    categories: [
      { id: 'cat-super', name: 'Súper', icon: 'cart-shopping' },
      { id: 'cat-nafta', name: 'Nafta', icon: 'gas-pump' },
      { id: 'cat-salidas', name: 'Salidas', icon: 'champagne-glasses' },
    ],
    monthExpenses: expenses,
    extrasThisMonth: [],
    fixed: [],
    savings: [],
    savingMoves: [],
    lastLoggedOn: null,
    salaryHistory: [],
  } as unknown as FinanceData
}

describe('budgetShare / budgetSpent', () => {
  it('suma privados propios enteros', () => {
    const rows = [
      expense({ id: '1', amount: 10000, isShared: false, ownerId: me, categoryId: 'cat-super' }),
      expense({ id: '2', amount: 5000, isShared: false, ownerId: partner, categoryId: 'cat-super' }),
    ]
    expect(budgetSpent(data(rows), me, 'cat-super')).toBe(10000)
  })

  it('suma la parte del compartido (monto × %), no sharedPaid', () => {
    const shared = expense({
      id: '1',
      amount: 30000,
      isShared: true,
      ownerId: partner,
      payerId: partner,
      categoryId: 'cat-super',
    })
    expect(budgetShare(shared, me, 60)).toBe(18000)
    expect(budgetSpent(data([shared]), me, 'cat-super')).toBe(18000)
  })

  it('usa 50 % si el mes está parejo', () => {
    const shared = expense({
      id: '1',
      amount: 30000,
      isShared: true,
      ownerId: me,
      categoryId: 'cat-super',
    })
    expect(budgetSpent(data([shared], true, 60), me, 'cat-super')).toBe(15000)
  })

  it('ignora gastos sin categoría', () => {
    const rows = [
      expense({ id: '1', amount: 9000, isShared: false, ownerId: me, categoryId: null }),
    ]
    expect(budgetSpent(data(rows), me, 'cat-super')).toBe(0)
  })
})

describe('budgetPercent / budgetState', () => {
  it('trunca el porcentaje hacia abajo', () => {
    expect(budgetPercent(50400, 60000)).toBe(84)
    expect(budgetPercent(47999, 60000)).toBe(79)
  })

  it('marca cerca desde ≥ 80 % y pasado solo si supera el tope', () => {
    expect(budgetState(47999, 60000)).toBe('normal')
    expect(budgetState(48000, 60000)).toBe('cerca')
    expect(budgetState(60000, 60000)).toBe('tope')
    expect(budgetState(60001, 60000)).toBe('pasado')
  })
})

describe('budgetOrder / textos', () => {
  it('ordena por % descendente y nombre', () => {
    const rows = budgetRowsForMonth(
      data([
        expense({ id: '1', amount: 56000, isShared: false, ownerId: me, categoryId: 'cat-nafta' }),
        expense({ id: '2', amount: 50400, isShared: false, ownerId: me, categoryId: 'cat-salidas' }),
        expense({ id: '3', amount: 74400, isShared: false, ownerId: me, categoryId: 'cat-super' }),
      ]),
      me,
      [
        { categoryId: 'cat-super', amount: 120000 },
        { categoryId: 'cat-nafta', amount: 50000 },
        { categoryId: 'cat-salidas', amount: 60000 },
      ],
    )
    expect(rows.map((row) => row.name)).toEqual(['Nafta', 'Salidas', 'Súper'])
    expect(rows[0]?.percent).toBe(112)
    expect(budgetStatusLine(rows[0]!)).toMatch(/Te pasaste por/)
    expect(budgetStatusLine(rows[1]!)).toMatch(/Cerca del tope/)
    expect(budgetAriaLabel(rows[0]!)).toContain('112 %')
  })

  it('empate de % ordena por nombre', () => {
    const ordered = budgetOrder([
      {
        categoryId: 'b',
        name: 'Bebidas',
        icon: 'x',
        spent: 50,
        cap: 100,
        percent: 50,
        state: 'normal',
      },
      {
        categoryId: 'a',
        name: 'Almacén',
        icon: 'x',
        spent: 50,
        cap: 100,
        percent: 50,
        state: 'normal',
      },
    ])
    expect(ordered.map((row) => row.name)).toEqual(['Almacén', 'Bebidas'])
  })
})
