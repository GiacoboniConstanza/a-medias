import { describe, expect, it } from 'vitest'
import type { ExpenseItem, SavingItem, SavingMove } from './api.ts'
import {
  countSelectable,
  movementSelectability,
  negativeSavingWarnings,
  type SelectableContext,
  type SelectableInputRow,
} from './movement-select.ts'
import type { Transfer } from './transfers.ts'

const meId = 'coty'
const partner = 'maru'

function expense(partial: Partial<ExpenseItem> & Pick<ExpenseItem, 'id'>): ExpenseItem {
  return {
    title: 'Gasto',
    amount: 100,
    spentOn: '2026-11-10',
    period: '2026-11-01',
    isShared: true,
    paidFromBag: false,
    payerId: meId,
    ownerId: meId,
    categoryId: null,
    notes: null,
    mpOperationId: null,
    ...partial,
  }
}

function saving(partial: Partial<SavingItem> & Pick<SavingItem, 'id' | 'name'>): SavingItem {
  return {
    householdId: 'h',
    icon: 'piggy-bank',
    target: null,
    targetDate: null,
    isShared: true,
    ownerId: null,
    archivedAt: null,
    openings: [{ userId: meId, amount: 0 }, { userId: partner, amount: 0 }],
    ...partial,
  }
}

function move(partial: Partial<SavingMove> & Pick<SavingMove, 'id' | 'kind' | 'amount' | 'spentOn'>): SavingMove {
  return {
    savingId: 'sav',
    householdId: 'h',
    userId: meId,
    period: '2026-11-01',
    title: null,
    notes: null,
    ...partial,
  }
}

function ctx(partial: Partial<SelectableContext> = {}): SelectableContext {
  return {
    meId,
    partnerName: 'Maru',
    fixedExpenseIds: new Set(),
    savingsById: new Map(),
    allSavingMoves: [],
    ...partial,
  }
}

function row(partial: Partial<SelectableInputRow> & Pick<SelectableInputRow, 'id' | 'kind'>): SelectableInputRow {
  return {
    title: 'Fila',
    amount: 10,
    spentOn: '2026-11-10',
    period: '2026-11-01',
    isShared: false,
    ...partial,
  }
}

describe('qué se puede eliminar', () => {
  it('bloquea el sueldo', () => {
    expect(movementSelectability(row({ id: 's', kind: 'sueldo', isSalary: true }), ctx()).canDelete).toBe(false)
    expect(movementSelectability(row({ id: 's', kind: 'sueldo', isSalary: true }), ctx()).reason).toMatch(/sueldo/i)
  })

  it('bloquea pagos de gastos fijos', () => {
    const e = expense({ id: 'fix-exp' })
    const result = movementSelectability(
      row({ id: e.id, kind: 'gasto', expense: e }),
      ctx({ fixedExpenseIds: new Set([e.id]) }),
    )
    expect(result.canDelete).toBe(false)
    expect(result.reason).toMatch(/Avisos/)
  })

  it('bloquea transferencias que cargó Maru', () => {
    const transfer: Transfer = {
      id: 't1',
      fromId: partner,
      toId: meId,
      amount: 1000,
      transferredOn: '2026-11-10',
      period: '2026-11-01',
      notes: null,
      createdBy: partner,
      mpOperationId: null,
    }
    const result = movementSelectability(row({ id: 't1', kind: 'transferencia', transfer }), ctx())
    expect(result.canDelete).toBe(false)
    expect(result.reason).toBe('La cargó Maru: solo ella la puede eliminar.')
  })

  it('permite transferencias propias', () => {
    const transfer: Transfer = {
      id: 't2',
      fromId: meId,
      toId: partner,
      amount: 1000,
      transferredOn: '2026-11-10',
      period: '2026-11-01',
      notes: null,
      createdBy: meId,
      mpOperationId: null,
    }
    expect(movementSelectability(row({ id: 't2', kind: 'transferencia', transfer }), ctx()).canDelete).toBe(true)
  })

  it('bloquea aportes de ahorro archivado', () => {
    const sav = saving({ id: 'sav', name: 'Vacaciones', archivedAt: '2026-11-01T00:00:00Z' })
    const sm = move({ id: 'm1', kind: 'aporte', amount: 100, spentOn: '2026-10-01', savingId: 'sav' })
    const result = movementSelectability(
      row({ id: 'm1', kind: 'aporte', savingMove: sm }),
      ctx({ savingsById: new Map([['sav', sav]]) }),
    )
    expect(result.canDelete).toBe(false)
    expect(result.reason).toMatch(/archivado/)
  })

  it('permite gastos compartidos de Maru e ingresos', () => {
    const e = expense({ id: 'g1', ownerId: partner, isShared: true })
    expect(movementSelectability(row({ id: 'g1', kind: 'gasto', expense: e }), ctx()).canDelete).toBe(true)
    expect(movementSelectability(row({ id: 'i1', kind: 'ingreso', extraId: 'x1' }), ctx()).canDelete).toBe(true)
  })

  it('cuenta solo las seleccionables', () => {
    const rows = [
      row({ id: 'ok', kind: 'gasto', expense: expense({ id: 'ok' }) }),
      row({ id: 'sueldo', kind: 'sueldo', isSalary: true }),
    ]
    expect(countSelectable(rows, ctx())).toBe(1)
  })
})

describe('aviso de ahorro en negativo', () => {
  it('avisa si borrar un aporte deja la parte en negativo por un retiro', () => {
    const sav = saving({
      id: 'sav',
      name: 'Vacaciones',
      openings: [{ userId: meId, amount: 0 }, { userId: partner, amount: 0 }],
    })
    const aporte = move({ id: 'a1', kind: 'aporte', amount: 20_000, spentOn: '2026-11-10', savingId: 'sav' })
    const retiro = move({ id: 'r1', kind: 'retiro', amount: 15_000, spentOn: '2026-11-11', savingId: 'sav' })
    const rows = [
      row({ id: 'a1', kind: 'aporte', title: 'Aporte', amount: 20_000, spentOn: '2026-11-10', savingMove: aporte }),
      row({ id: 'r1', kind: 'retiro', title: 'Retiro', amount: 15_000, spentOn: '2026-11-11', savingMove: retiro }),
    ]
    const warnings = negativeSavingWarnings(
      new Set(['a1']),
      rows,
      ctx({
        savingsById: new Map([['sav', sav]]),
        allSavingMoves: [aporte, retiro],
      }),
    )
    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.savingName).toBe('Vacaciones')
    expect(warnings[0]?.aporteRowId).toBe('a1')
    expect(warnings[0]?.retiroRowId).toBe('r1')
    expect(warnings[0]?.negativeAmount).toBe(15_000)
  })

  it('no avisa si también se elige el retiro', () => {
    const sav = saving({ id: 'sav', name: 'Vacaciones' })
    const aporte = move({ id: 'a1', kind: 'aporte', amount: 20_000, spentOn: '2026-11-10', savingId: 'sav' })
    const retiro = move({ id: 'r1', kind: 'retiro', amount: 15_000, spentOn: '2026-11-11', savingId: 'sav' })
    const rows = [
      row({ id: 'a1', kind: 'aporte', amount: 20_000, spentOn: '2026-11-10', savingMove: aporte }),
      row({ id: 'r1', kind: 'retiro', amount: 15_000, spentOn: '2026-11-11', savingMove: retiro }),
    ]
    expect(
      negativeSavingWarnings(
        new Set(['a1', 'r1']),
        rows,
        ctx({ savingsById: new Map([['sav', sav]]), allSavingMoves: [aporte, retiro] }),
      ),
    ).toHaveLength(0)
  })
})
