import { formatMoney } from './format.ts'

export const MONTH_INITIALS = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'] as const

export const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const

export const CATEGORY_COLORS = [
  { fill: 'var(--color-azul)', ink: 'var(--color-tinta)' },
  { fill: 'var(--color-ciruela)', ink: 'var(--color-tinta)' },
  { fill: 'var(--color-mostaza-ink)', ink: 'var(--color-crema)' },
  { fill: 'var(--color-rosa-hondo)', ink: 'var(--color-crema)' },
  { fill: 'var(--color-azul)', ink: 'var(--color-tinta)' },
  { fill: 'var(--color-salvia-ink)', ink: 'var(--color-crema)' },
] as const

export type YearMonth = {
  month: number
  base: number | null
  extras: number | null
  expenses: number | null
  saved: number | null
}

export type YearCategory = {
  id: string
  name: string
  icon: string
  total: number
  months: (number | null)[]
}

export type YearSaving = {
  id: string
  name: string
  icon: string
  isShared: boolean
  archived: boolean
  target: number | null
  balance: number
  mine: number
  yearIn: number
  yearOut: number
}

export type YearHighlight = {
  label: string
  amount: number
  month: number
  savingName: string
  savingIcon: string
}

export type YearTotals = {
  income: number | null
  expenses: number | null
  saved: number | null
}

export type YearReport = {
  year: number
  months: YearMonth[]
  categories: YearCategory[]
  previous: YearTotals
  extrasTotal: number | null
  savings: YearSaving[]
  highlight: YearHighlight | null
  dues: { onTime: number; expected: number }
}

export type YearMoment = {
  icon: string
  tone: 'blush' | 'sun' | 'sage'
  text: string
}

export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? ''
}

export function monthHeading(month: number): string {
  const name = monthName(month)
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : ''
}

export function isFutureMonth(year: number, month: number, today = new Date()): boolean {
  return year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth() + 1)
}

export function yearCell(value: number | null): string {
  return value === null ? '—' : formatMoney(value)
}

export function yearHasData(report: YearReport, today = new Date()): boolean {
  return report.months.some((month) => {
    if (month.base !== null && !isFutureMonth(report.year, month.month, today)) return true
    return month.extras !== null || month.expenses !== null
  })
}

export function yearTotals(months: YearMonth[], year: number, today = new Date()): YearTotals {
  let income: number | null = null
  let expenses: number | null = null
  let saved: number | null = null
  for (const month of months) {
    if (isFutureMonth(year, month.month, today)) continue
    if (month.base !== null || month.extras !== null) {
      income = (income ?? 0) + (month.base ?? 0) + (month.extras ?? 0)
    }
    if (month.expenses !== null) expenses = (expenses ?? 0) + month.expenses
    if (month.saved !== null) saved = (saved ?? 0) + month.saved
  }
  return { income, expenses, saved }
}

export function salaryChanges(months: YearMonth[]): { month: number; from: number; to: number }[] {
  const changes: { month: number; from: number; to: number }[] = []
  let previous: number | null = null
  for (const month of months) {
    if (month.base === null) continue
    if (previous !== null && month.base !== previous) {
      changes.push({ month: month.month, from: previous, to: month.base })
    }
    previous = month.base
  }
  return changes
}

function joinMonths(months: number[]): string {
  const names = months.map((month) => monthHeading(month))
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`
}

export function incomeCaption(months: YearMonth[], year: number, today = new Date()): string {
  const arrived = months.filter((month) => month.base !== null && !isFutureMonth(year, month.month, today))
  const changes = salaryChanges(arrived)
  const future = months.filter((month) => isFutureMonth(year, month.month, today)).map((month) => month.month)
  let text: string
  if (arrived.length === 0) {
    text = 'Cuando cargues el sueldo base, vas a ver cómo se movió en el año.'
  } else {
    const last = changes[changes.length - 1]
    if (last) {
      text = `Tu sueldo base pasó de ${formatMoney(last.from)} a ${formatMoney(last.to)} en ${monthName(last.month)}.`
    } else {
      text = `Tu sueldo base de este año es ${formatMoney(arrived[arrived.length - 1]?.base ?? 0)}.`
    }
  }
  if (future.length === 1) text += ` ${joinMonths(future)} todavía no llegó.`
  if (future.length > 1) text += ` ${joinMonths(future)} todavía no llegaron.`
  return text
}

export function yearGlancePhrase(current: YearTotals, previous: YearTotals): string {
  if (previous.income === null && previous.saved === null) {
    return 'Este año es tuyo. Acá vas a ver cómo te fue, con calma.'
  }
  const earnedMore = (current.income ?? 0) > (previous.income ?? 0)
  const earnedLess = (current.income ?? 0) < (previous.income ?? 0)
  const savedMore = (current.saved ?? 0) > (previous.saved ?? 0)
  const savedLess = (current.saved ?? 0) < (previous.saved ?? 0)
  if (earnedMore && savedMore) return 'Este año ganaste más y ahorraste más que el anterior'
  if (earnedMore && savedLess) return 'Este año ganaste más. El ahorro fue más chico, y está bien mirarlo con calma'
  if (earnedLess && savedMore) return 'Este año ahorraste más, aunque los ingresos fueron más chicos'
  if (earnedLess && savedLess) return 'Este año fue más tranquilo. Lo lindo es que lo estás mirando'
  if (earnedMore) return 'Este año ganaste más que el anterior'
  if (savedMore) return 'Este año ahorraste más que el anterior'
  return 'Este año se pareció bastante al anterior'
}

export function bestSavingMonth(months: YearMonth[], year: number, today = new Date()): YearMonth | null {
  let best: YearMonth | null = null
  for (const month of months) {
    if (month.saved === null || isFutureMonth(year, month.month, today)) continue
    if (!best || month.saved > best.saved! || (month.saved === best.saved && month.month > best.month)) best = month
  }
  return best
}

export function biggestSpendingMonth(months: YearMonth[], year: number, today = new Date()): YearMonth | null {
  let best: YearMonth | null = null
  for (const month of months) {
    if (month.expenses === null || isFutureMonth(year, month.month, today)) continue
    if (!best || month.expenses > best.expenses! || (month.expenses === best.expenses && month.month > best.month)) best = month
  }
  return best
}

export function categoryPercents(categories: YearCategory[]): number[] {
  const total = categories.reduce((sum, category) => sum + category.total, 0)
  if (total <= 0) return categories.map(() => 0)
  const percents = categories.map((category) => Math.round((category.total / total) * 100))
  const drift = 100 - percents.reduce((sum, percent) => sum + percent, 0)
  if (percents[0] !== undefined) percents[0] += drift
  return percents
}

export function categoryJump(categories: YearCategory[], year: number, today = new Date()): string {
  let best: { name: string; percent: number; fromMonth: number; toMonth: number } | null = null
  for (const category of categories) {
    for (let index = 1; index < category.months.length; index += 1) {
      const previous = category.months[index - 1]
      const current = category.months[index]
      const fromMonth = index
      const toMonth = index + 1
      if (isFutureMonth(year, fromMonth, today) || isFutureMonth(year, toMonth, today)) continue
      if (previous === null || current === null || previous <= 0 || current <= previous) continue
      const percent = (current - previous) / previous
      if (!best || percent > best.percent) {
        best = { name: category.name, percent, fromMonth, toMonth }
      }
    }
  }
  if (!best || best.percent < 0.1) {
    return 'Tus categorías se mantuvieron bastante parejas. Qué lindo poder verlo así.'
  }
  const percent = Math.round(best.percent * 100)
  return `En ${monthName(best.toMonth)} gastaste ${percent}% más en ${best.name.toLowerCase()} que en ${monthName(best.fromMonth)}.`
}

export function duesSentence(onTime: number, expected: number): string {
  if (expected <= 0) return 'Cuando anotes vencimientos, vamos a celebrar los que queden pagos a tiempo.'
  if (onTime <= 0) return `Tenés ${expected} vencimientos anotados este año. Cada uno que marques va a aparecer acá.`
  if (onTime === expected) {
    return expected === 1
      ? 'El vencimiento del año quedó pago a tiempo. ¡Bien ahí!'
      : `Quedaron pagos a tiempo los ${expected} vencimientos del año. ¡Bien ahí!`
  }
  return `Quedaron pagos a tiempo ${onTime} de ${expected} vencimientos. ¡Bien ahí!`
}

export function highlightSentence(highlight: YearHighlight | null): string {
  if (!highlight) return 'Cuando cargues un aporte grande, lo vamos a recordar acá.'
  const when = `de ${monthName(highlight.month)}`
  const money = formatMoney(highlight.amount)
  return `Tu aporte ${when} (${money}) fue a ${highlight.savingName}.`
}

export function yearMoments(report: YearReport, today = new Date()): YearMoment[] {
  const jump = categoryJump(report.categories, report.year, today)
  const jumpIcon = report.categories[0]?.icon || 'seedling'
  return [
    { icon: jump.startsWith('En ') ? jumpIcon : 'seedling', tone: 'blush', text: jump },
    { icon: report.highlight?.savingIcon || 'piggy-bank', tone: 'sun', text: highlightSentence(report.highlight) },
    { icon: 'house-circle-check', tone: 'sage', text: duesSentence(report.dues.onTime, report.dues.expected) },
  ]
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function asMonthList(value: unknown): (number | null)[] {
  if (!Array.isArray(value)) return Array.from({ length: 12 }, () => null)
  const months = value.slice(0, 12).map((item) => asNumber(item))
  while (months.length < 12) months.push(null)
  return months
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export function parseYearBalance(value: unknown): YearReport {
  const row = asRecord(value)
  if (!row || !Array.isArray(row.months)) throw new Error('El balance no llegó completo')
  const previous = asRecord(row.previous)
  const dues = asRecord(row.dues)
  const highlight = asRecord(row.highlight)
  return {
    year: asNumber(row.year) ?? 0,
    months: row.months.map((item) => {
      const month = asRecord(item)
      return {
        month: asNumber(month?.month) ?? 0,
        base: asNumber(month?.base),
        extras: asNumber(month?.extras),
        expenses: asNumber(month?.expenses),
        saved: asNumber(month?.saved),
      }
    }),
    categories: (Array.isArray(row.categories) ? row.categories : []).flatMap((item) => {
      const category = asRecord(item)
      if (!category || typeof category.id !== 'string') return []
      return [
        {
          id: category.id,
          name: typeof category.name === 'string' ? category.name : 'Categoría',
          icon: typeof category.icon === 'string' ? category.icon : 'tag',
          total: asNumber(category.total) ?? 0,
          months: asMonthList(category.months),
        },
      ]
    }),
    previous: {
      income: asNumber(previous?.income),
      expenses: asNumber(previous?.expenses),
      saved: asNumber(previous?.saved),
    },
    extrasTotal: asNumber(row.extras_total),
    savings: (Array.isArray(row.savings) ? row.savings : []).flatMap((item) => {
      const saving = asRecord(item)
      if (!saving || typeof saving.id !== 'string') return []
      return [
        {
          id: saving.id,
          name: typeof saving.name === 'string' ? saving.name : 'Ahorro',
          icon: typeof saving.icon === 'string' ? saving.icon : 'piggy-bank',
          isShared: Boolean(saving.is_shared),
          archived: Boolean(saving.archived),
          target: asNumber(saving.target),
          balance: asNumber(saving.balance) ?? 0,
          mine: asNumber(saving.mine) ?? 0,
          yearIn: asNumber(saving.year_in) ?? 0,
          yearOut: asNumber(saving.year_out) ?? 0,
        },
      ]
    }),
    highlight:
      highlight && typeof highlight.saving_name === 'string'
        ? {
            label: typeof highlight.label === 'string' ? highlight.label : 'Aporte',
            amount: asNumber(highlight.amount) ?? 0,
            month: asNumber(highlight.month) ?? 1,
            savingName: highlight.saving_name,
            savingIcon: typeof highlight.saving_icon === 'string' ? highlight.saving_icon : 'piggy-bank',
          }
        : null,
    dues: {
      onTime: asNumber(dues?.on_time) ?? 0,
      expected: asNumber(dues?.expected) ?? 0,
    },
  }
}
