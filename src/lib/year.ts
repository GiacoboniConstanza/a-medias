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

/** Meses por defecto de la comparación (A = que mirás, B = contra). */
export function defaultCompareMonths(
  year: number,
  today = new Date(),
): { monthA: number; monthB: number; yearB: number } {
  const currentYear = today.getFullYear()
  if (year !== currentYear) {
    return { monthA: 12, monthB: 11, yearB: year }
  }
  const currentMonth = today.getMonth() + 1
  if (currentMonth === 1) {
    return { monthA: 1, monthB: 12, yearB: year - 1 }
  }
  return { monthA: currentMonth, monthB: currentMonth - 1, yearB: year }
}

export function monthIncome(month: YearMonth | undefined): number | null {
  if (!month) return null
  if (month.base === null && month.extras === null) return null
  return (month.base ?? 0) + (month.extras ?? 0)
}

export function monthIsEmpty(month: YearMonth | undefined): boolean {
  if (!month) return true
  return month.base === null && month.extras === null && month.expenses === null
}

export type MonthDeltaKind = 'equal' | 'new' | 'gone' | 'up' | 'down' | 'diff_only' | 'under_one'

export type MonthDelta = {
  a: number
  b: number
  diff: number
  kind: MonthDeltaKind
  /** Entero con signo cuando kind es up/down. */
  percent: number | null
}

/** Diferencia de B → A. category: etiquetas nueva / sin gastos. */
export function monthDelta(
  a: number | null | undefined,
  b: number | null | undefined,
  opts?: { category?: boolean },
): MonthDelta {
  const av = a ?? 0
  const bv = b ?? 0
  const diff = av - bv
  if (diff === 0) {
    return { a: av, b: bv, diff: 0, kind: 'equal', percent: null }
  }
  if (opts?.category) {
    if (bv === 0 && av > 0) return { a: av, b: bv, diff, kind: 'new', percent: null }
    if (av === 0 && bv > 0) return { a: av, b: bv, diff, kind: 'gone', percent: null }
  } else if (bv === 0) {
    return { a: av, b: bv, diff, kind: 'diff_only', percent: null }
  }
  const rounded = Math.round((Math.abs(diff) / Math.abs(bv)) * 100)
  if (rounded === 0) {
    return { a: av, b: bv, diff, kind: 'under_one', percent: null }
  }
  const percent = diff > 0 ? rounded : -rounded
  return { a: av, b: bv, diff, kind: diff > 0 ? 'up' : 'down', percent }
}

export function formatSignedMoney(diff: number): string {
  if (diff === 0) return formatMoney(0)
  const body = formatMoney(Math.abs(diff))
  return diff > 0 ? `+${body}` : `−${body}`
}

export function deltaPercentLabel(delta: MonthDelta): string {
  if (delta.kind === 'equal') return '= igual'
  if (delta.kind === 'new') return 'nueva'
  if (delta.kind === 'gone') return 'sin gastos'
  if (delta.kind === 'under_one') return 'menos de 1 %'
  if (delta.kind === 'diff_only' || delta.percent == null) return ''
  const sign = delta.percent > 0 ? '+' : '−'
  return `${sign}${Math.abs(delta.percent)} %`
}

export type CompareCategoryRow = {
  id: string
  name: string
  icon: string
  a: number
  b: number
  delta: MonthDelta
}

export function compareCategories(
  reportA: YearReport,
  monthA: number,
  reportB: YearReport,
  monthB: number,
): CompareCategoryRow[] {
  const byId = new Map<string, { name: string; icon: string; a: number | null; b: number | null }>()
  for (const category of reportA.categories) {
    byId.set(category.id, {
      name: category.name,
      icon: category.icon,
      a: category.months[monthA - 1] ?? null,
      b: null,
    })
  }
  for (const category of reportB.categories) {
    const prev = byId.get(category.id)
    if (prev) {
      prev.b = category.months[monthB - 1] ?? null
    } else {
      byId.set(category.id, {
        name: category.name,
        icon: category.icon,
        a: null,
        b: category.months[monthB - 1] ?? null,
      })
    }
  }
  const rows: CompareCategoryRow[] = []
  for (const [id, row] of byId) {
    const spentA = row.a != null && row.a > 0
    const spentB = row.b != null && row.b > 0
    if (!spentA && !spentB) continue
    const delta = monthDelta(row.a, row.b, { category: true })
    rows.push({
      id,
      name: row.name,
      icon: row.icon,
      a: row.a ?? 0,
      b: row.b ?? 0,
      delta,
    })
  }
  rows.sort((left, right) => {
    const leftEqual = left.delta.kind === 'equal'
    const rightEqual = right.delta.kind === 'equal'
    if (leftEqual !== rightEqual) return leftEqual ? 1 : -1
    const abs = Math.abs(right.delta.diff) - Math.abs(left.delta.diff)
    if (abs !== 0) return abs
    return left.name.localeCompare(right.name, 'es')
  })
  return rows
}

export type ComparePhrase = {
  headline: string
  detail: string | null
}

export function comparePhrase(
  row: CompareCategoryRow | null,
  monthA: number,
  monthB: number,
): ComparePhrase {
  if (!row) {
    return { headline: 'Tus categorías se mantuvieron bastante parejas.', detail: null }
  }
  const aName = monthName(monthA)
  const bName = monthName(monthB)
  const money = formatMoney(Math.abs(row.delta.diff))
  if (row.delta.kind === 'new') {
    return {
      headline: `En ${aName} empezaste a gastar en ${row.name}`,
      detail: `${money} más que en ${bName}`,
    }
  }
  if (row.delta.kind === 'gone') {
    return {
      headline: `En ${aName} no gastaste en ${row.name}`,
      detail: `${money} menos que en ${bName}`,
    }
  }
  if (row.delta.kind === 'equal') {
    return { headline: 'Tus categorías se mantuvieron bastante parejas.', detail: null }
  }
  const percent = Math.abs(row.delta.percent ?? 0)
  const more = row.delta.diff > 0
  const word = more ? 'más' : 'menos'
  const pct =
    row.delta.kind === 'under_one' ? 'menos de 1' : String(percent)
  return {
    headline: `En ${aName} gastaste ${pct} % ${word} en ${row.name} que en ${bName}`,
    detail: `${money} ${word} que en ${bName}`,
  }
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
