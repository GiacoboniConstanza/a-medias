import { monthKey } from './month.ts'

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

export function shortPeriodLabel(period: string): string {
  const month = Number(period.slice(5, 7))
  return SHORT_MONTHS[month - 1] ?? ''
}

export function sharedMonthSettled(isShared: boolean, period: string, settledMonths: readonly string[]): boolean {
  const month = period.slice(0, 10)
  return isShared && settledMonths.some((settled) => settled.slice(0, 10) === month)
}

/** Texto de Cargar / resumen cuando un gasto compartido cae en mes saldado (P4). */
export function settledSharedHelp(period: string): string {
  const [yearText, monthText] = period.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const raw = new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(
    new Date(Number.isFinite(year) ? year : 2026, Number.isFinite(month) ? month - 1 : 0, 1),
  )
  const Mes = raw.charAt(0).toUpperCase() + raw.slice(1)
  return `${Mes} está saldado: un gasto compartido no se puede cargar ahí. Pasalo a privado o deshacé el saldo en Resumen.`
}

export function expenseIsReadOnly(
  expense: { isShared: boolean; ownerId: string; period: string } | null | undefined,
  meId: string,
  settledMonths: readonly string[],
): boolean {
  if (!expense) return false
  if (sharedMonthSettled(expense.isShared, expense.period, settledMonths)) return true
  return !expense.isShared && expense.ownerId !== meId
}

export function ownerCanMakePrivate(ownerId: string, meId: string): boolean {
  return ownerId === meId
}

export function sumPaidBy(expenses: readonly { payerId: string; amount: number }[], payerId: string): number {
  return expenses.filter((expense) => expense.payerId === payerId).reduce((sum, expense) => sum + expense.amount, 0)
}

export function monthSharedTotal(
  expenses: readonly { period: string; amount: number; isShared: boolean }[],
  month: string,
): number {
  return expenses
    .filter((expense) => expense.isShared && expense.period === month)
    .reduce((sum, expense) => sum + expense.amount, 0)
}

