import { formatMoney, fromCents, toCents } from './format.ts'
import { monthTitle } from './month.ts'

export function goalProgress(saved: number, target: number): { label: string; arc: number } {
  if (target <= 0 || saved <= 0) return { label: '0%', arc: 0 }
  const ratio = saved / target
  if (ratio < 0.01) return { label: '<1%', arc: 0.015 }
  return { label: `${Math.round(ratio * 100)}%`, arc: Math.min(ratio, 1) }
}

export function monthsUntil(targetDate: string, today = new Date()): number {
  const [year, month] = targetDate.split('-').map(Number)
  if (!year || !month) return 0
  return (year - today.getFullYear()) * 12 + (month - 1 - today.getMonth())
}

export function monthsLeftCopy(months: number): string {
  if (months > 1) return `faltan ${months} meses`
  if (months === 1) return 'falta 1 mes'
  if (months === 0) return 'es este mes'
  return 'la fecha ya pasó'
}

export function evenMonthlyShare(remaining: number, months: number): number | null {
  if (remaining <= 0 || months <= 0) return null
  return fromCents(Math.max(1, Math.ceil(toCents(remaining / 2 / months))))
}

export function shareLabel(amount: number, total: number): string {
  if (amount <= 0 || total <= 0) return '0%'
  const ratio = amount / total
  if (ratio < 0.01) return '<1%'
  return `${Math.round(ratio * 100)}%`
}

/** Ritmo del detalle compartido con meta y fecha (P8). */
export function goalPaceLine(targetDate: string | null, months: number, monthlyEach: number | null): string {
  if (!monthlyEach) {
    if (!targetDate) return ''
    return `${monthTitle(targetDate)} · ${monthsLeftCopy(months)}`
  }
  return `Si cada una suma ${formatMoney(monthlyEach)} por mes, llegan.`
}
