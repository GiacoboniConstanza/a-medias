import { monthEnd, todayISO } from './month.ts'

export function goalProgress(saved: number, target: number): { label: string; arc: number } {
  if (target <= 0 || saved <= 0) return { label: '0%', arc: 0 }
  const ratio = saved / target
  if (ratio < 0.01) return { label: '<1%', arc: 0.015 }
  return { label: `${Math.round(ratio * 100)}%`, arc: Math.min(ratio, 1) }
}

export function goalPhrase(saved: number, target: number): string {
  if (target <= 0 || saved <= 0) return '¡Arrancaron! Cada aporte suma'
  const ratio = saved / target
  if (ratio < 0.25) return 'Van sumando. Cada aporte cuenta'
  if (ratio < 0.5) return 'Ya se nota. Sigan así'
  if (ratio < 0.75) return 'Van por buen camino'
  if (ratio < 1) return 'Ya casi llegan'
  return '¡Llegaron a la meta!'
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
  return Math.max(1, Math.ceil(remaining / 2 / months))
}

export function salaryShare(remaining: number, months: number, percent: number): number | null {
  if (remaining <= 0 || percent <= 0) return null
  const base = months > 0 ? remaining / months : remaining
  const share = Math.round(base * (percent / 100))
  return share > 0 ? share : null
}

export function shareLabel(amount: number, total: number): string {
  if (amount <= 0 || total <= 0) return '0%'
  const ratio = amount / total
  if (ratio < 0.01) return '<1%'
  return `${Math.round(ratio * 100)}%`
}

export function contributionInMonth(createdAt: string, month: string): boolean {
  const day = todayISO(new Date(createdAt))
  return day >= month && day <= monthEnd(month)
}
