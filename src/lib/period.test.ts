import { describe, expect, it } from 'vitest'
import { monthSharedTotal, movementInMonth, periodFollowsDate, periodFromDate, shortPeriodLabel } from './period.ts'

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
