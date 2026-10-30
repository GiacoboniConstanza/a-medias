import { monthEnd, monthKey } from './month.ts'

const SHORT_MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'] as const

/** Día 1 del mes de una fecha ISO. Si la fecha no sirve, usa el mes de hoy. */
export function periodFromDate(iso: string, today = new Date()): string {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(iso)
  if (!match) return monthKey(today)
  return `${match[1]}-${match[2]}-01`
}

/**
 * El período sigue a la fecha hasta que la persona elige un mes a propósito.
 * Si ya lo tocó, se queda en el mes elegido (normalizado al día 1).
 */
export function periodFollowsDate(spentOn: string, period: string, periodTouched: boolean, today = new Date()): string {
  if (periodTouched) return periodFromDate(period, today)
  return periodFromDate(spentOn, today)
}

export function periodDiffersFromDate(spentOn: string, period: string): boolean {
  return periodFromDate(spentOn) !== periodFromDate(period)
}

export function shortPeriodLabel(period: string): string {
  const month = Number(period.slice(5, 7))
  return SHORT_MONTHS[month - 1] ?? ''
}

export function monthSharedTotal(
  expenses: readonly { period: string; amount: number; isShared: boolean }[],
  month: string,
): number {
  return expenses
    .filter((expense) => expense.isShared && expense.period === month)
    .reduce((sum, expense) => sum + expense.amount, 0)
}

/** Un gusto entra en el mes de su período. El resto de la bolsa, en la fecha del movimiento. */
export function movementInMonth(
  movement: { kind: string; happenedOn: string; linkedToPeriod: boolean },
  monthStart: string,
): boolean {
  if (movement.kind === 'gusto') return movement.linkedToPeriod
  const end = monthEnd(monthStart)
  return movement.happenedOn >= monthStart && movement.happenedOn <= end
}
