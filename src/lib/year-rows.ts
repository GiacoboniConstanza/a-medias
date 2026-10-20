import { formatMoney } from './format.ts'
import { isFutureMonth, monthHeading, monthName, type YearMonth } from './year.ts'

export type MonthListRow =
  | { kind: 'month'; month: YearMonth }
  | { kind: 'empty'; from: number; to: number }
  | { kind: 'future'; from: number; to: number }

export function monthHasRecords(month: YearMonth): boolean {
  return month.base !== null || month.extras !== null || month.expenses !== null || month.saved !== null
}

export function monthRows(months: YearMonth[], year: number, today: Date): MonthListRow[] {
  const rows: MonthListRow[] = []
  let index = 0
  while (index < months.length) {
    const current = months[index]
    if (!current) break
    if (isFutureMonth(year, current.month, today)) {
      const from = current.month
      let to = current.month
      index += 1
      while (index < months.length) {
        const next = months[index]
        if (!next || !isFutureMonth(year, next.month, today)) break
        to = next.month
        index += 1
      }
      rows.push({ kind: 'future', from, to })
      continue
    }
    if (!monthHasRecords(current)) {
      const from = current.month
      let to = current.month
      index += 1
      while (index < months.length) {
        const next = months[index]
        if (!next || isFutureMonth(year, next.month, today) || monthHasRecords(next)) break
        to = next.month
        index += 1
      }
      rows.push({ kind: 'empty', from, to })
      continue
    }
    rows.push({ kind: 'month', month: current })
    index += 1
  }
  return rows
}

export function monthSpan(from: number, to: number): string {
  if (from === to) return monthHeading(from)
  if (to === from + 1) return `${monthHeading(from)} y ${monthName(to)}`
  return `${monthHeading(from)} a ${monthName(to)}`
}

export function abbreviateMoney(value: number): string {
  const full = formatMoney(value)
  const abs = Math.abs(Math.round(value))
  if (abs < 10_000) return full
  const sign = value < 0 ? '-' : ''
  const short = abs >= 1_000_000 ? `${sign}$ ${trimScaled(abs / 1_000_000)} M` : `${sign}$ ${trimScaled(abs / 1_000)} mil`
  return short.length < full.length ? short : full
}

function trimScaled(value: number): string {
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',')
}
