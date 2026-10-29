import { describe, expect, it } from 'vitest'
import {
  bestSavingMonth,
  biggestSpendingMonth,
  categoryJump,
  duesSentence,
  gustosSentence,
  highlightSentence,
  incomeCaption,
  isFutureMonth,
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
    expect(yearCell(0)).toBe('$ 0')
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
    expect(incomeCaption(months, 2026, today)).toContain('pasó de $ 1.500.000 a $ 1.800.000 en julio')
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
      gustosSpent: 40_000,
      extrasTotal: 450_000,
      extrasSaved: 300_000,
      funds: [],
      goal: null,
      highlight: {
        label: 'Incentivo',
        extraAmount: 1_040_000,
        amount: 1_040_000,
        month: 8,
        fundName: 'Lollapalooza',
        fundIcon: 'music',
      },
      dues: { onTime: 9, expected: 10 },
    } as YearReport
    const moments = yearMoments(report, today)
    expect(moments).toHaveLength(3)
    expect(moments.map((moment) => moment.text).join(' ')).not.toMatch(/culpa|demasiado|te pasaste|mal/)
    expect(highlightSentence(report.highlight)).toBe('Tu incentivo de agosto ($ 1.040.000) fue directo a Lollapalooza.')
    expect(duesSentence(9, 10)).toBe('Quedaron pagos a tiempo 9 de 10 vencimientos. ¡Bien ahí!')
    expect(gustosSentence(40_000, 450_000, 300_000)).toContain('67%')
    expect(yearHasData(report, today)).toBe(true)
  })
})
