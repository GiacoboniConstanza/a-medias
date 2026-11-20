import { describe, expect, it } from 'vitest'
import { formatMoney } from './format.ts'
import {
  bestSavingMonth,
  biggestSpendingMonth,
  categoryJump,
  compareCategories,
  comparePhrase,
  defaultCompareMonths,
  deltaPercentLabel,
  duesSentence,
  formatSignedMoney,
  highlightSentence,
  incomeCaption,
  isFutureMonth,
  monthDelta,
  salaryChanges,
  yearCell,
  yearGlancePhrase,
  yearHasData,
  yearMoments,
  yearTotals,
  type YearCategory,
  type YearMonth,
  type YearReport,
} from './year.ts'

const today = new Date(2026, 9, 20)

function month(partial: Partial<YearMonth> & { month: number }): YearMonth {
  return { base: null, extras: null, expenses: null, saved: null, ...partial }
}

const months: YearMonth[] = [
  month({ month: 1, base: 1_500_000, saved: 1_500_000 }),
  month({ month: 2, base: 1_500_000, extras: null, expenses: null, saved: 1_500_000 }),
  month({ month: 6, base: 1_500_000, saved: 1_500_000 }),
  month({ month: 7, base: 1_800_000, expenses: 640_000, saved: 1_160_000 }),
  month({ month: 12, base: 1_800_000, saved: null }),
]

describe('balance anual', () => {
  it('un mes sin movimientos no se muestra como cero', () => {
    expect(yearCell(null)).toBe('—')
    expect(yearCell(0)).toBe('$ 0,00')
  })

  it('los meses futuros no suman y un extra vacío no es cero', () => {
    const totals = yearTotals(months, 2026, today)
    expect(isFutureMonth(2026, 12, today)).toBe(true)
    expect(isFutureMonth(2026, 10, today)).toBe(false)
    expect(totals.income).toBe(1_500_000 * 3 + 1_800_000)
    expect(totals.expenses).toBe(640_000)
    expect(totals.saved).toBe(1_500_000 * 3 + 1_160_000)
  })

  it('marca el cambio de sueldo a mitad de año', () => {
    expect(salaryChanges(months)).toEqual([{ month: 7, from: 1_500_000, to: 1_800_000 }])
    expect(incomeCaption(months, 2026, today)).toContain('pasó de $ 1.500.000,00 a $ 1.800.000,00 en julio')
    expect(incomeCaption(months, 2026, today)).toContain('Diciembre todavía no llegó')
  })

  it('elige el mejor mes y el más gastador solo entre los que ya llegaron', () => {
    expect(bestSavingMonth(months, 2026, today)?.month).toBe(6)
    expect(biggestSpendingMonth(months, 2026, today)?.month).toBe(7)
    expect(biggestSpendingMonth([month({ month: 3 })], 2026, today)).toBeNull()
  })

  it('si no hay año anterior, la frase es neutra', () => {
    expect(yearGlancePhrase({ income: 10, expenses: 4, saved: 6 }, { income: null, expenses: null, saved: null })).toBe(
      'Este año es tuyo. Acá vas a ver cómo te fue, con calma.',
    )
    expect(yearGlancePhrase({ income: 20, expenses: 5, saved: 15 }, { income: 10, expenses: 8, saved: 2 })).toBe(
      'Este año ganaste más y ahorraste más que el anterior',
    )
  })

  it('cuenta la suba de una categoría sin culpar', () => {
    const categories: YearCategory[] = [
      {
        id: 'salidas',
        name: 'Salidas',
        icon: 'champagne-glasses',
        total: 230,
        months: [null, null, null, null, null, null, null, 100, 130, null, null, null],
      },
    ]
    expect(categoryJump(categories, 2026, today)).toBe('En septiembre gastaste 30% más en salidas que en agosto.')
    expect(categoryJump([], 2026, today)).toBe('Tus categorías se mantuvieron bastante parejas. Qué lindo poder verlo así.')
  })

  it('arma tres momentos amables', () => {
    const report = {
      year: 2026,
      months,
      categories: [],
      previous: { income: null, expenses: null, saved: null },
      extrasTotal: 450_000,
      savings: [],
      highlight: {
        label: 'Incentivo',
        amount: 1_040_000,
        month: 8,
        savingName: 'Lollapalooza',
        savingIcon: 'music',
      },
      dues: { onTime: 9, expected: 10 },
    } as YearReport
    const moments = yearMoments(report, today)
    expect(moments).toHaveLength(3)
    expect(moments.map((moment) => moment.text).join(' ')).not.toMatch(/culpa|demasiado|te pasaste|mal/)
    expect(highlightSentence(report.highlight)).toBe('Tu aporte de agosto ($ 1.040.000,00) fue a Lollapalooza.')
    expect(duesSentence(9, 10)).toBe('Quedaron pagos a tiempo 9 de 10 vencimientos. ¡Bien ahí!')
    expect(yearHasData(report, today)).toBe(true)
  })
})

describe('comparar meses', () => {
  it('elige el par por defecto y enero contra diciembre', () => {
    expect(defaultCompareMonths(2026, new Date(2026, 10, 15))).toEqual({
      monthA: 11,
      monthB: 10,
      yearB: 2026,
    })
    expect(defaultCompareMonths(2026, new Date(2026, 0, 8))).toEqual({
      monthA: 1,
      monthB: 12,
      yearB: 2025,
    })
    expect(defaultCompareMonths(2025, new Date(2026, 10, 15))).toEqual({
      monthA: 12,
      monthB: 11,
      yearB: 2025,
    })
  })

  it('redondea el %, marca menos de 1 %, base 0 y signos', () => {
    expect(monthDelta(920_000, 880_000)).toMatchObject({ diff: 40_000, kind: 'up', percent: 5 })
    expect(monthDelta(1000, 1004)).toMatchObject({ kind: 'under_one', percent: null })
    expect(monthDelta(50, 0)).toMatchObject({ kind: 'diff_only', percent: null, diff: 50 })
    expect(monthDelta(50, 0, { category: true })).toMatchObject({ kind: 'new' })
    expect(monthDelta(0, 50, { category: true })).toMatchObject({ kind: 'gone' })
    expect(monthDelta(95, 95, { category: true })).toMatchObject({ kind: 'equal' })
    expect(formatSignedMoney(40_000)).toBe(`+${formatMoney(40_000)}`)
    expect(formatSignedMoney(-3_500)).toBe(`−${formatMoney(3_500)}`)
    expect(deltaPercentLabel(monthDelta(68, 50, { category: true }))).toBe('+36 %')
    expect(deltaPercentLabel(monthDelta(1000, 1004))).toBe('menos de 1 %')
    expect(deltaPercentLabel(monthDelta(10, 0, { category: true }))).toBe('nueva')
    expect(deltaPercentLabel(monthDelta(0, 10, { category: true }))).toBe('sin gastos')
    expect(deltaPercentLabel(monthDelta(5, 5))).toBe('= igual')
  })

  it('ordena categorías por |diff| y deja igual al final', () => {
    const months = (values: (number | null)[]) => {
      const list = Array.from({ length: 12 }, () => null as number | null)
      values.forEach((value, index) => {
        list[index] = value
      })
      return list
    }
    const report: YearReport = {
      year: 2026,
      months: [],
      previous: { income: null, expenses: null, saved: null },
      extrasTotal: null,
      savings: [],
      highlight: null,
      dues: { onTime: 0, expected: 0 },
      categories: [
        { id: 'hogar', name: 'Hogar', icon: 'house', total: 190, months: months([null, null, null, null, null, null, null, null, null, 95, 95, null]) },
        { id: 'salidas', name: 'Salidas', icon: 'champagne-glasses', total: 118, months: months([null, null, null, null, null, null, null, null, null, 50, 68, null]) },
        { id: 'nafta', name: 'Nafta', icon: 'gas-pump', total: 90, months: months([null, null, null, null, null, null, null, null, null, 52, 38, null]) },
        { id: 'regalos', name: 'Regalos', icon: 'gift', total: 12.5, months: months([null, null, null, null, null, null, null, null, null, null, 12.5, null]) },
        { id: 'ropa', name: 'Ropa', icon: 'shirt', total: 9.4, months: months([null, null, null, null, null, null, null, null, null, 9.4, null, null]) },
      ],
    }
    const rows = compareCategories(report, 11, report, 10)
    expect(rows.map((row) => row.name)).toEqual(['Salidas', 'Nafta', 'Regalos', 'Ropa', 'Hogar'])
    expect(rows[0]?.delta.kind).toBe('up')
    expect(rows[2]?.delta.kind).toBe('new')
    expect(rows[3]?.delta.kind).toBe('gone')
    expect(rows[4]?.delta.kind).toBe('equal')
  })

  it('arma la frase destacada y cruza enero con diciembre', () => {
    const salidas = {
      id: 'salidas',
      name: 'Salidas',
      icon: 'champagne-glasses',
      a: 68_000,
      b: 50_000,
      delta: monthDelta(68_000, 50_000, { category: true }),
    }
    expect(comparePhrase(salidas, 11, 10)).toEqual({
      headline: 'En noviembre gastaste 36 % más en Salidas que en octubre',
      detail: `${formatMoney(18_000)} más que en octubre`,
    })
    expect(comparePhrase(null, 11, 10).headline).toMatch(/parejas/)

    const year2026: YearReport = {
      year: 2026,
      months: [],
      categories: [
        {
          id: 'super',
          name: 'Súper',
          icon: 'cart-shopping',
          total: 10,
          months: [10, null, null, null, null, null, null, null, null, null, null, null],
        },
      ],
      previous: { income: null, expenses: null, saved: null },
      extrasTotal: null,
      savings: [],
      highlight: null,
      dues: { onTime: 0, expected: 0 },
    }
    const year2025: YearReport = {
      ...year2026,
      year: 2025,
      categories: [
        {
          id: 'super',
          name: 'Súper',
          icon: 'cart-shopping',
          total: 4,
          months: [null, null, null, null, null, null, null, null, null, null, null, 4],
        },
      ],
    }
    const crossed = compareCategories(year2026, 1, year2025, 12)
    expect(crossed).toHaveLength(1)
    expect(crossed[0]?.a).toBe(10)
    expect(crossed[0]?.b).toBe(4)
    expect(crossed[0]?.delta.diff).toBe(6)
  })
})
