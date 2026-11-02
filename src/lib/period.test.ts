import { describe, expect, it } from 'vitest'
import { catamarcaToday, isAfterDay } from './month.ts'
import {
  deleteExpenseConfirm,
  expenseIsReadOnly,
  monthSharedTotal,
  movementInMonth,
  ownerCanMakePrivate,
  periodFollowsDate,
  periodFromDate,
  sharedMonthSettled,
  shortPeriodLabel,
  sumPaidBy,
} from './period.ts'

describe('período por defecto', () => {
  it('toma el día 1 del mes de la fecha', () => {
    expect(periodFromDate('2026-11-18')).toBe('2026-11-01')
    expect(periodFromDate('2026-01-31')).toBe('2026-01-01')
  })

  it('sigue a la fecha mientras nadie eligió el mes', () => {
    expect(periodFollowsDate('2026-12-02', '2026-11-01', false)).toBe('2026-12-01')
  })

  it('se queda en el mes elegido aunque cambie la fecha', () => {
    expect(periodFollowsDate('2026-12-02', '2026-11-15', true)).toBe('2026-11-01')
  })

  it('abrevia el mes para la etiqueta', () => {
    expect(shortPeriodLabel('2026-11-01')).toBe('Nov')
  })
})

describe('totales del mes', () => {
  const expenses = [
    { period: '2026-11-01', amount: 100, isShared: true, spentOn: '2026-10-28' },
    { period: '2026-10-01', amount: 40, isShared: true, spentOn: '2026-11-02' },
    { period: '2026-11-01', amount: 15, isShared: false, spentOn: '2026-11-03' },
  ]

  it('suma los compartidos por period y no por la fecha real', () => {
    expect(monthSharedTotal(expenses, '2026-11-01')).toBe(100)
    expect(monthSharedTotal(expenses, '2026-10-01')).toBe(40)
  })

  it('manda el gusto de la bolsa al mes del período', () => {
    expect(
      movementInMonth(
        { kind: 'gusto', happenedOn: '2026-10-28', linkedToPeriod: true },
        '2026-11-01',
      ),
    ).toBe(true)
    expect(
      movementInMonth(
        { kind: 'gusto', happenedOn: '2026-11-02', linkedToPeriod: false },
        '2026-11-01',
      ),
    ).toBe(false)
    expect(
      movementInMonth(
        { kind: 'to_fund', happenedOn: '2026-11-04', linkedToPeriod: false },
        '2026-11-01',
      ),
    ).toBe(true)
  })
})

describe('fecha de Catamarca', () => {
  it('a la 1 UTC del 3 de noviembre sigue siendo 2 de noviembre', () => {
    expect(catamarcaToday(new Date('2026-11-03T01:00:00.000Z'))).toBe('2026-11-02')
  })

  it('hoy pasa y mañana no', () => {
    expect(isAfterDay('2026-11-02', '2026-11-02')).toBe(false)
    expect(isAfterDay('2026-11-03', '2026-11-02')).toBe(true)
  })
})

describe('permisos de un gasto', () => {
  const settled = ['2026-10-01']
  const shared = { isShared: true, ownerId: 'coty', period: '2026-10-01' }
  const ownPrivate = { isShared: false, ownerId: 'coty', period: '2026-10-01' }

  it('la otra persona edita un compartido abierto y no lo pasa a privado', () => {
    expect(expenseIsReadOnly({ ...shared, period: '2026-11-01' }, 'maru', settled)).toBe(false)
    expect(ownerCanMakePrivate('coty', 'maru')).toBe(false)
    expect(ownerCanMakePrivate('coty', 'coty')).toBe(true)
  })

  it('un privado ajeno no se edita', () => {
    expect(expenseIsReadOnly(ownPrivate, 'maru', [])).toBe(true)
  })

  it('un compartido saldado queda cerrado y el privado del mismo mes no', () => {
    expect(expenseIsReadOnly(shared, 'coty', settled)).toBe(true)
    expect(expenseIsReadOnly(ownPrivate, 'coty', settled)).toBe(false)
    expect(sharedMonthSettled(true, '2026-10-01', settled)).toBe(true)
    expect(sharedMonthSettled(false, '2026-10-01', settled)).toBe(false)
    expect(sharedMonthSettled(true, '2026-11-01', settled)).toBe(false)
  })

  it('suma solo lo que pagó esa persona', () => {
    expect(
      sumPaidBy(
        [
          { payerId: 'coty', amount: 100 },
          { payerId: 'maru', amount: 40 },
        ],
        'coty',
      ),
    ).toBe(100)
  })

  it('mantiene el texto de confirmar el borrado', () => {
    expect(deleteExpenseConfirm).toBe('¿Eliminar este gasto? No se puede deshacer.')
  })
})
