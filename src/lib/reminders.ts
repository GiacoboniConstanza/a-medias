import { todayISO } from './month.ts'

export const DEFAULT_FIRST_TIME = '14:00'
export const DEFAULT_SECOND_TIME = '21:30'

export type ReminderPrefs = {
  enabled: boolean
  firstTime: string
  secondTime: string
  reviewedOn: string | null
  hiddenUntil: string | null
}

export const DEFAULT_REMINDER_PREFS: ReminderPrefs = {
  enabled: true,
  firstTime: DEFAULT_FIRST_TIME,
  secondTime: DEFAULT_SECOND_TIME,
  reviewedOn: null,
  hiddenUntil: null,
}

export function clockLabel(value: string): string {
  const match = /^(\d{2}):(\d{2})/.exec(value.trim())
  if (!match?.[1] || !match[2]) return DEFAULT_FIRST_TIME
  return `${match[1]}:${match[2]}`
}

export function clockMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match?.[1] || !match[2]) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return hour * 60 + minute
}

export function reminderTimesValid(first: string, second: string): boolean {
  const start = clockMinutes(first)
  const end = clockMinutes(second)
  return start !== null && end !== null && start < end
}

export function atClock(day: Date, time: string): Date {
  const minutes = clockMinutes(time)
  if (minutes === null) throw new Error('Horario inválido')
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minutes / 60), minutes % 60, 0, 0)
}

export function nextAskAt(now: Date, firstTime: string, secondTime: string): Date {
  const firstSlot = atClock(now, firstTime)
  const secondSlot = atClock(now, secondTime)
  if (now.getTime() < firstSlot.getTime()) return firstSlot
  if (now.getTime() < secondSlot.getTime()) return secondSlot
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return atClock(tomorrow, firstTime)
}

export function shouldAskToday(now: Date, prefs: ReminderPrefs): boolean {
  if (!prefs.enabled || !reminderTimesValid(prefs.firstTime, prefs.secondTime)) return false
  if (prefs.reviewedOn === todayISO(now)) return false
  if (prefs.hiddenUntil) {
    const until = new Date(prefs.hiddenUntil)
    if (!Number.isNaN(until.getTime()) && now.getTime() < until.getTime()) return false
  }
  return now.getTime() >= atClock(now, prefs.firstTime).getTime()
}

export function laterCopy(now: Date, next: Date): string {
  const hours = String(next.getHours()).padStart(2, '0')
  const minutes = String(next.getMinutes()).padStart(2, '0')
  const when = todayISO(now) === todayISO(next) ? `a las ${hours}:${minutes}` : `mañana a las ${hours}:${minutes}`
  return `Te lo vuelvo a mostrar ${when}.`
}

export function reminderFootnote(prefs: Pick<ReminderPrefs, 'enabled' | 'firstTime' | 'secondTime'>): string {
  const schedule = prefs.enabled
    ? `Te preguntamos a las ${prefs.firstTime} y a las ${prefs.secondTime} si gastaste algo.`
    : 'El recordatorio diario está apagado.'
  return `${schedule} Los avisos del celular quedan preparados y todavía no se envían. Cada gasto fijo avisa con los días de anticipación que elijas.`
}
