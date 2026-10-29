import { describe, expect, it } from 'vitest'
import { expenseSpan, monthWeekSpans, weekendDates } from './expense-range.ts'

describe('semanas del mes', () => {
  it('recorta la primera semana cuando el mes no empieza en lunes', () => {
    expect(monthWeekSpans('2026-10-01')).toEqual([
      { from: '2026-10-01', to: '2026-10-04' },
      { from: '2026-10-05', to: '2026-10-11' },
      { from: '2026-10-12', to: '2026-10-18' },
      { from: '2026-10-19', to: '2026-10-31' },
    ])
  })

  it('toma semanas completas si el mes empieza en lunes', () => {
    expect(monthWeekSpans('2026-06-01')[0]).toEqual({ from: '2026-06-01', to: '2026-06-07' })
    expect(monthWeekSpans('2026-06-01')[3]).toEqual({ from: '2026-06-22', to: '2026-06-30' })
  })

  it('deja el domingo suelto como semana 1', () => {
    expect(monthWeekSpans('2026-02-01')[0]).toEqual({ from: '2026-02-01', to: '2026-02-01' })
    expect(monthWeekSpans('2026-02-01')[3].to).toBe('2026-02-28')
  })

  it('arma los fines de semana con sábados y domingos', () => {
    const dates = weekendDates('2026-10-01')
    expect(dates).toContain('2026-10-03')
    expect(dates).toContain('2026-10-04')
    expect(dates).not.toContain('2026-10-01')
    expect(dates.every((iso) => iso >= '2026-10-01' && iso <= '2026-10-31')).toBe(true)
  })

  it('mantiene el rango elegido dentro del mes', () => {
    expect(expenseSpan('2026-10-01', 'custom', '2026-09-20', '2026-10-12')).toEqual({
      kind: 'range',
      from: '2026-10-01',
      to: '2026-10-12',
    })
  })
})
