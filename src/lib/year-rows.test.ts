import { describe, expect, it } from 'vitest'
import { abbreviateMoney, monthRows, monthSpan } from './year-rows.ts'
import type { YearMonth } from './year.ts'

function month(monthNumber: number, saved: number | null = null): YearMonth {
  const filled = saved !== null
  return {
    month: monthNumber,
    base: filled ? 100 : null,
    extras: filled ? 0 : null,
    expenses: filled ? 0 : null,
    saved,
  }
}

describe('monthRows', () => {
  const today = new Date(2026, 9, 20)

  it('agrupa meses vacíos y deja los futuros en una sola línea', () => {
    const months = Array.from({ length: 12 }, (_, index) => month(index + 1, index === 9 ? 1200 : null))
    const rows = monthRows(months, 2026, today)
    expect(rows.map((row) => (row.kind === 'month' ? `mes ${row.month.month}` : `${row.kind} ${monthSpan(row.from, row.to)}`))).toEqual([
      'empty Enero a septiembre',
      'mes 10',
      'future Noviembre y diciembre',
    ])
  })

  it('usa y para dos meses y el singular cuando falta uno solo', () => {
    expect(monthSpan(11, 12)).toBe('Noviembre y diciembre')
    expect(monthSpan(12, 12)).toBe('Diciembre')
    const rows = monthRows([month(11), month(12)], 2026, today)
    expect(rows).toEqual([{ kind: 'future', from: 11, to: 12 }])
    expect(monthRows([month(12)], 2026, today)).toEqual([{ kind: 'future', from: 12, to: 12 }])
  })
})

describe('abbreviateMoney', () => {
  it('deja el monto completo cuando entra y lo acorta cuando no', () => {
    expect(abbreviateMoney(1234)).toBe('$ 1.234')
    expect(abbreviateMoney(1_234_567)).toBe('$ 1,2 M')
    expect(abbreviateMoney(-2_400_000)).toBe('-$ 2,4 M')
  })
})
