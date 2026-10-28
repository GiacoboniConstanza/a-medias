import { todayISO } from './month.ts'

export const DEFAULT_FIRST_TIME = '14:00'
export const DEFAULT_SECOND_TIME = '21:30'
export const MAX_ASK_TIMES = 4

export type DailyKind = 'logged' | 'clear'

export type DayAsk = {
  logged: boolean
  clear: boolean
}

export type ReminderPrefs = {
  enabled: boolean
  times: string[]
  reviewedOn: string | null
  hiddenUntil: string | null
  dueLeadDays: number
  notifyShared: boolean
  sundaySummary: boolean
  pushEnabled: boolean
}

export const DEFAULT_REMINDER_PREFS: ReminderPrefs = {
  enabled: true,
  times: [DEFAULT_FIRST_TIME, DEFAULT_SECOND_TIME],
  reviewedOn: null,
  hiddenUntil: null,
  dueLeadDays: 2,
  notifyShared: true,
  sundaySummary: false,
  pushEnabled: false,
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

function asClock(value: string): string | null {
  const match = /^(\d{2}):(\d{2})/.exec(value.trim())
  if (!match?.[1] || !match[2]) return null
  const label = `${match[1]}:${match[2]}`
  return clockMinutes(label) === null ? null : label
}

export function sortedTimes(times: string[]): string[] {
  const unique = new Set<string>()
  for (const time of times) {
    const label = asClock(time)
    if (label) unique.add(label)
  }
  return [...unique].sort((left, right) => (clockMinutes(left) ?? 0) - (clockMinutes(right) ?? 0))
}

export function timesValid(times: string[]): boolean {
  if (times.length < 1 || times.length > 6) return false
  const labels = times.map((time) => asClock(time))
  if (labels.some((label) => label === null)) return false
  return new Set(labels).size === labels.length
}

export function nextTimeSlot(times: string[]): string | null {
  const sorted = sortedTimes(times)
  if (sorted.length >= MAX_ASK_TIMES) return null
  const last = clockMinutes(sorted[sorted.length - 1] ?? '13:00') ?? 13 * 60
  for (let step = 60; step < 24 * 60; step += 30) {
    const minutes = (last + step) % (24 * 60)
    const label = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
    if (!sorted.includes(label)) return label
  }
  return null
}

export function atClock(day: Date, time: string): Date {
  const minutes = clockMinutes(clockLabel(time))
  if (minutes === null) throw new Error('Horario inválido')
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minutes / 60), minutes % 60, 0, 0)
}

export function nextAskAt(now: Date, times: string[]): Date {
  const slots = sortedTimes(times)
  const first = slots[0]
  if (!first) throw new Error('Horario inválido')
  for (const time of slots) {
    const slot = atClock(now, time)
    if (now.getTime() < slot.getTime()) return slot
  }
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return atClock(tomorrow, first)
}

export function shouldAskToday(now: Date, prefs: ReminderPrefs, day?: DayAsk): boolean {
  if (!prefs.enabled) return false
  if (day?.logged || day?.clear) return false
  const slots = sortedTimes(prefs.times)
  const first = slots[0]
  if (!first) return false
  if (prefs.reviewedOn === todayISO(now)) return false
  if (prefs.hiddenUntil) {
    const until = new Date(prefs.hiddenUntil)
    if (!Number.isNaN(until.getTime()) && now.getTime() < until.getTime()) return false
  }
  return now.getTime() >= atClock(now, first).getTime()
}

export function laterCopy(now: Date, next: Date): string {
  const hours = String(next.getHours()).padStart(2, '0')
  const minutes = String(next.getMinutes()).padStart(2, '0')
  const when = todayISO(now) === todayISO(next) ? `a las ${hours}:${minutes}` : `mañana a las ${hours}:${minutes}`
  return `Te lo vuelvo a mostrar ${when}.`
}

export function reminderFootnote(prefs: Pick<ReminderPrefs, 'enabled' | 'times'>): string {
  const slots = sortedTimes(prefs.times)
  const schedule = prefs.enabled
    ? `Te preguntamos a las ${slots.join(' y a las ')} si gastaste algo.`
    : 'El recordatorio diario está apagado.'
  return `${schedule} Los avisos del celular quedan preparados y todavía no se envían.`
}

export function shiftDay(iso: string, delta: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  return todayISO(new Date(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + delta))
}

/** Días seguidos con un gasto anotado. Si hoy todavía no, cuenta hasta ayer. */
export function loggingStreak(loggedDays: readonly string[], today: string): number {
  const days = new Set(loggedDays)
  let cursor = days.has(today) ? today : shiftDay(today, -1)
  let count = 0
  while (days.has(cursor)) {
    count += 1
    cursor = shiftDay(cursor, -1)
    if (count > 800) break
  }
  return count
}

export function streakCopy(count: number): string {
  if (count === 1) return '1 día seguido anotando'
  return `${count} días seguidos anotando`
}
