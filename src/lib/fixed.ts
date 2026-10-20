import { monthKey, shortDate } from './month.ts'

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

export function dueLabel(dueDay: number, month: string, today: Date): string {
  const [year, monthNumber] = month.split('-')
  const due = `${year}-${monthNumber}-${String(dueDay).padStart(2, '0')}`
  if (month > monthKey(today)) return `Vence el ${shortDate(due)}`
  if (month < monthKey(today)) return `Venció el ${shortDate(due)}`
  const diff = dueDay - today.getDate()
  if (diff < 0) {
    const days = Math.abs(diff)
    return `Venció hace ${days} ${days === 1 ? 'día' : 'días'}`
  }
  if (diff === 0) return 'Vence hoy'
  if (diff === 1) return 'Vence mañana'
  return `Vence en ${diff} días`
}

export function editedCaption(updatedAt: string, name: string): string {
  const date = new Date(updatedAt)
  const day = String(date.getDate()).padStart(2, '0')
  const monthNumber = String(date.getMonth() + 1).padStart(2, '0')
  const who = name.trim() || 'alguien'
  return `Editado por ${who} el ${day}/${monthNumber}`
}
