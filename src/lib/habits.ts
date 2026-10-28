import { todayISO } from './month.ts'

/** 0 es lunes y 6 es domingo. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export const WEEKDAYS: readonly { index: Weekday; label: string; name: string }[] = [
  { index: 0, label: 'L', name: 'Lunes' },
  { index: 1, label: 'M', name: 'Martes' },
  { index: 2, label: 'M', name: 'Miércoles' },
  { index: 3, label: 'J', name: 'Jueves' },
  { index: 4, label: 'V', name: 'Viernes' },
  { index: 5, label: 'S', name: 'Sábado' },
  { index: 6, label: 'D', name: 'Domingo' },
]

export const ALL_DAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6]

export type SproutStage = 'empty' | 'seed' | 'sprout' | 'medium' | 'grown'

export type Habit = {
  id: string
  name: string
  iconName: string
  daysOfWeek: number[]
  archived: boolean
}

export type HabitCheck = {
  habitId: string
  day: string
}

export function weekdayIndex(date: Date): Weekday {
  const js = date.getDay()
  return (js === 0 ? 6 : js - 1) as Weekday
}

export function isScheduledOn(daysOfWeek: readonly number[], date: Date): boolean {
  return daysOfWeek.includes(weekdayIndex(date))
}

export function habitsForDay(habits: readonly Habit[], date: Date): Habit[] {
  return habits.filter((habit) => !habit.archived && isScheduledOn(habit.daysOfWeek, date))
}

export function todayProgress(habits: readonly Habit[], checks: readonly HabitCheck[], date: Date): { done: number; total: number } {
  const iso = todayISO(date)
  const scheduled = habitsForDay(habits, date)
  const done = scheduled.filter((habit) => checks.some((check) => check.habitId === habit.id && check.day === iso)).length
  return { done, total: scheduled.length }
}

export function todayCounterLabel(done: number, total: number): string {
  return `${done} de ${total}`
}

export function startOfWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  start.setDate(start.getDate() - weekdayIndex(start))
  return start
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  next.setDate(next.getDate() + days)
  return next
}

export type DayMoment = 'past' | 'today' | 'future'

export type DaySnapshot = {
  iso: string
  scheduled: number
  done: number
  when: DayMoment
}

export function weekSnapshots(habits: readonly Habit[], checks: readonly HabitCheck[], weekStart: Date, today: Date): DaySnapshot[] {
  const todayIso = todayISO(today)
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index)
    const iso = todayISO(date)
    const progress = todayProgress(habits, checks, date)
    const when: DayMoment = iso === todayIso ? 'today' : iso < todayIso ? 'past' : 'future'
    return { iso, scheduled: progress.total, done: progress.done, when }
  })
}

export function weekCounter(days: readonly DaySnapshot[]): { touched: number; elapsed: number } {
  const elapsed = days.filter((day) => day.when !== 'future' && day.scheduled > 0)
  return {
    touched: elapsed.filter((day) => day.done > 0).length,
    elapsed: elapsed.length,
  }
}

export function weekCounterLabel(touched: number, elapsed: number): string {
  return `${touched} de ${elapsed} días`
}

/** Día futuro o sin hábitos: maceta vacía. Sin cumplir: semilla. Después crece como la maceta de la bolsa. */
export function sproutStage(done: number, scheduled: number, when: DayMoment): SproutStage {
  if (when === 'future' || scheduled <= 0) return 'empty'
  if (done <= 0) return 'seed'
  const percent = (Math.min(done, scheduled) / scheduled) * 100
  if (percent < 25) return 'sprout'
  if (percent < 75) return 'medium'
  return 'grown'
}

export function visibleLeaves(done: number, total: number): { solid: number; dashed: number } {
  const safeTotal = Math.max(0, total)
  const safeDone = Math.min(Math.max(0, done), safeTotal)
  const solid = Math.min(safeDone, 5)
  const dashed = Math.min(safeTotal - safeDone, 5 - solid)
  return { solid, dashed }
}

export function habitPlantCopy(done: number, total: number): { title: string; detail: string } {
  if (total <= 0) return { title: 'Tu plantita', detail: 'Cuando marques un hábito, le crece una hoja.' }
  const missing = Math.max(total - done, 0)
  if (done <= 0) {
    return {
      title: 'Tu plantita',
      detail: missing === 1 ? 'Te falta 1 hábito para completarla.' : `Te faltan ${missing} hábitos para completarla.`,
    }
  }
  const leaves = done === 1 ? '1 hoja nueva' : `${done} hojas nuevas`
  if (missing === 0) return { title: 'Tu plantita creció hoy', detail: `${leaves}. Completaste los hábitos de hoy.` }
  const rest = missing === 1 ? 'Te falta 1 hábito para completarla.' : `Te faltan ${missing} hábitos para completarla.`
  return { title: 'Tu plantita creció hoy', detail: `${leaves}. ${rest}` }
}

export function weekTitle(weekStart: Date, today: Date): string {
  const current = todayISO(weekStart) === todayISO(startOfWeek(today))
  if (current) return 'Esta semana'
  const label = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' }).format(weekStart)
  return `Semana del ${label}`
}

export function normalizeDays(days: readonly number[]): Weekday[] {
  return [...new Set(days.filter((day): day is Weekday => day >= 0 && day <= 6 && Number.isInteger(day)))].sort((a, b) => a - b)
}
