import { monthKey } from './month.ts'

export type AmountRevision = {
  effectiveFrom: string
  amount: number
}

/** Monto que rige en ese mes. Los meses anteriores conservan la revisión previa. */
export function amountForMonth(revisions: AmountRevision[], month: string): number | null {
  let best: AmountRevision | null = null
  for (const revision of revisions) {
    if (revision.effectiveFrom <= month && (best === null || revision.effectiveFrom > best.effectiveFrom)) {
      best = revision
    }
  }
  return best?.amount ?? null
}

export function withRevision(revisions: AmountRevision[], revision: AmountRevision): AmountRevision[] {
  return [...revisions.filter((row) => row.effectiveFrom !== revision.effectiveFrom), revision]
}

/** Columna expected_amount: lo que cuesta en el mes calendario, sin pisar el futuro. */
export function scheduleAmount(revisions: AmountRevision[], todayMonth: string, revision: AmountRevision | null): number {
  const next = revision ? withRevision(revisions, revision) : revisions
  const current = amountForMonth(next, todayMonth)
  if (current !== null) return current
  const earliest = [...next].sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom))[0]
  return earliest?.amount ?? 0
}

export type DueVisual = 'late' | 'upcoming'

export function dueVisual(dueDay: number, month: string, today: Date): DueVisual {
  const current = monthKey(today)
  if (month > current) return 'upcoming'
  if (month < current) return 'late'
  return dueDay < today.getDate() ? 'late' : 'upcoming'
}

export function dueDate(dueDay: number, month: string): Date {
  const [yearText, monthText] = month.split('-')
  const year = Number(yearText)
  const monthIndex = Number(monthText) - 1
  const last = new Date(year, monthIndex + 1, 0).getDate()
  return new Date(year, monthIndex, Math.min(Math.max(dueDay, 1), last))
}

export function dayDiff(dueDay: number, month: string, today: Date): number {
  const due = dueDate(dueDay, month)
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((due.getTime() - start.getTime()) / 86_400_000)
}

export type DueBucket = 'today' | 'week' | 'later'
export type DueTone = 'today' | 'soon' | 'late'

export function dueBucket(dueDay: number, month: string, today: Date): DueBucket {
  const diff = dayDiff(dueDay, month, today)
  if (diff <= 0) return 'today'
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const weekday = start.getDay()
  const untilSunday = weekday === 0 ? 0 : 7 - weekday
  if (diff <= untilSunday) return 'week'
  return 'later'
}

export function dueTone(dueDay: number, month: string, today: Date): DueTone {
  const diff = dayDiff(dueDay, month, today)
  if (diff < 0) return 'late'
  if (diff === 0) return 'today'
  return 'soon'
}

export function dueLabel(dueDay: number, month: string, today: Date): string {
  const diff = dayDiff(dueDay, month, today)
  if (diff === 0) return 'Hoy'
  if (diff > 0) return `en ${diff} ${diff === 1 ? 'día' : 'días'}`
  const days = Math.abs(diff)
  return `Venció hace ${days} ${days === 1 ? 'día' : 'días'}`
}

export function showPayLink(dueDay: number, month: string, today: Date): boolean {
  return dayDiff(dueDay, month, today) <= 0
}

export function shareSentence(myPercent: number, partnerPercent: number, partnerName: string, even: boolean): string {
  const name = partnerName.trim() || 'tu compañera'
  const sentence = `Se reparte ${myPercent}/${partnerPercent} con ${name}`
  return even ? sentence : `${sentence} por sueldo base`
}

export function remindSwitchLabel(days: number): string {
  if (days <= 0) return 'Avisarme el mismo día'
  if (days === 1) return 'Avisarme 1 día antes'
  return `Avisarme ${days} días antes`
}

export function editedCaption(updatedAt: string, name: string): string {
  const date = new Date(updatedAt)
  const day = String(date.getDate()).padStart(2, '0')
  const monthNumber = String(date.getMonth() + 1).padStart(2, '0')
  const who = name.trim() || 'alguien'
  return `Editado por ${who} el ${day}/${monthNumber}`
}
