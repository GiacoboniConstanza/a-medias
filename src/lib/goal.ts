import { formatMoney, fromCents, toCents } from './format.ts'
import { monthName, monthTitle } from './month.ts'

/**
 * Meses desde hoy hasta la meta, inclusive (mes actual + mes de la fecha).
 * Nov 2026 → mar 2027 = 5. Este mes = 1. Fecha pasada ≤ 0.
 */
export function monthsUntil(targetDate: string, today = new Date()): number {
  const [year, month] = targetDate.split('-').map(Number)
  if (!year || !month) return 0
  return (year - today.getFullYear()) * 12 + (month - today.getMonth())
}

export function monthsLeftCopy(months: number): string {
  if (months > 1) return `faltan ${months} meses`
  if (months === 1) return 'es este mes'
  return 'la fecha ya pasó'
}

/** Aporte mensual de una sola persona (personal): lo que falta / meses, redondeo hacia arriba al centavo. */
export function monthlyOwnShare(remaining: number, months: number): number | null {
  if (remaining <= 0 || months <= 0) return null
  return fromCents(Math.max(1, Math.ceil(toCents(remaining) / months)))
}

/** Mitad cada una (compartido). */
export function evenMonthlyShare(remaining: number, months: number): number | null {
  if (remaining <= 0 || months <= 0) return null
  return fromCents(Math.max(1, Math.ceil(toCents(remaining) / 2 / months)))
}

export function shareLabel(amount: number, total: number): string {
  if (amount <= 0 || total <= 0) return '0%'
  const ratio = amount / total
  if (ratio < 0.01) return '<1%'
  return `${Math.round(ratio * 100)}%`
}

export type GoalStatusLine = {
  text: string
  /** En el detalle, con fecha pasada y falta plata. */
  editGoal: boolean
}

/**
 * Línea de ritmo / caso borde para detalle o lista.
 * Sin meta o sin fecha → null (no cambia la UI).
 */
export function goalStatusLine(input: {
  isShared: boolean
  target: number | null | undefined
  targetDate: string | null | undefined
  balance: number
  today?: Date
  variant?: 'detail' | 'list'
}): GoalStatusLine | null {
  const target = input.target
  const targetDate = input.targetDate
  if (target == null || target <= 0 || !targetDate) return null

  const remaining = Math.max(0, target - input.balance)
  const months = monthsUntil(targetDate, input.today)
  const shared = input.isShared
  const list = input.variant === 'list'

  if (remaining <= 0) {
    return {
      text: shared ? '¡Llegaron a la meta!' : '¡Llegaste a la meta!',
      editGoal: false,
    }
  }

  if (months <= 0) {
    return {
      text: shared
        ? `La fecha ya pasó. Les faltan ${formatMoney(remaining)}.`
        : `La fecha ya pasó. Te faltan ${formatMoney(remaining)}.`,
      editGoal: !list,
    }
  }

  if (months === 1) {
    return {
      text: shared
        ? `Les faltan ${formatMoney(remaining)} para este mes.`
        : `Te faltan ${formatMoney(remaining)} para este mes.`,
      editGoal: false,
    }
  }

  const monthly = shared ? evenMonthlyShare(remaining, months) : monthlyOwnShare(remaining, months)
  if (!monthly) return null

  if (list) {
    return {
      text: `para ${monthName(targetDate)} · ${formatMoney(monthly)} por mes`,
      editGoal: false,
    }
  }

  return {
    text: shared
      ? `Si cada una suma ${formatMoney(monthly)} por mes, llegan.`
      : `Separá ${formatMoney(monthly)} por mes para llegar.`,
    editGoal: false,
  }
}

/** Ritmo del detalle compartido con meta y fecha (P8). Preferí goalStatusLine. */
export function goalPaceLine(targetDate: string | null, months: number, monthlyEach: number | null): string {
  if (!monthlyEach) {
    if (!targetDate) return ''
    return `${monthTitle(targetDate)} · ${monthsLeftCopy(months)}`
  }
  return `Si cada una suma ${formatMoney(monthlyEach)} por mes, llegan.`
}
