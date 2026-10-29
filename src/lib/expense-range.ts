import { daysInMonth, monthEnd, todayISO } from './month.ts'

export type DatePreset = 'month' | 'week1' | 'week2' | 'week3' | 'rest' | 'weekends' | 'custom'

export type DaySpan = { from: string; to: string }

export type ExpenseSpan = { kind: 'range'; from: string; to: string } | { kind: 'dates'; dates: string[] }

function dateAt(monthStart: string, day: number): Date {
  const [yearText, monthText] = monthStart.split('-')
  return new Date(Number(yearText), Number(monthText) - 1, day)
}

/** Semanas de lunes a domingo, recortadas al mes. La cuarta junta la semana 4 y la 5. */
export function monthWeekSpans(monthStart: string): [DaySpan, DaySpan, DaySpan, DaySpan] {
  const lastDay = daysInMonth(monthStart)
  const firstWeekday = dateAt(monthStart, 1).getDay()
  const week1End = firstWeekday === 0 ? 1 : 1 + (7 - firstWeekday)
  const cuts = [week1End, week1End + 7, week1End + 14, lastDay]
  let start = 1
  return cuts.map((endDay) => {
    const span = {
      from: todayISO(dateAt(monthStart, start)),
      to: todayISO(dateAt(monthStart, Math.min(endDay, lastDay))),
    }
    start = endDay + 1
    return span
  }) as [DaySpan, DaySpan, DaySpan, DaySpan]
}

export function weekendDates(monthStart: string): string[] {
  const lastDay = daysInMonth(monthStart)
  const dates: string[] = []
  for (let day = 1; day <= lastDay; day += 1) {
    const date = dateAt(monthStart, day)
    const weekday = date.getDay()
    if (weekday === 0 || weekday === 6) dates.push(todayISO(date))
  }
  return dates
}

function clampDay(value: string, monthStart: string, end: string): string {
  if (!value || value < monthStart) return monthStart
  if (value > end) return end
  return value
}

export function expenseSpan(monthStart: string, preset: DatePreset, customFrom: string, customTo: string): ExpenseSpan {
  const end = monthEnd(monthStart)
  if (preset === 'weekends') return { kind: 'dates', dates: weekendDates(monthStart) }
  if (preset === 'month') return { kind: 'range', from: monthStart, to: end }
  if (preset === 'custom') {
    let from = clampDay(customFrom, monthStart, end)
    let to = clampDay(customTo, monthStart, end)
    if (from > to) {
      const swap = from
      from = to
      to = swap
    }
    return { kind: 'range', from, to }
  }
  const weeks = monthWeekSpans(monthStart)
  const index = preset === 'week1' ? 0 : preset === 'week2' ? 1 : preset === 'week3' ? 2 : 3
  const week = weeks[index]
  return { kind: 'range', from: week.from, to: week.to }
}
