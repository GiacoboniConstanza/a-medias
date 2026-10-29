import { describe, expect, it } from 'vitest'
import {
  DEFAULT_REMINDER_PREFS,
  laterCopy,
  loggingStreak,
  nextAskAt,
  nextTimeSlot,
  reminderFootnote,
  shouldAskToday,
  streakCopy,
  timesValid,
} from './reminders.ts'

const prefs = { ...DEFAULT_REMINDER_PREFS, times: [...DEFAULT_REMINDER_PREFS.times] }

describe('aviso diario', () => {
  it('no aparece antes del primer horario', () => {
    expect(shouldAskToday(new Date(2026, 9, 20, 13, 59), prefs)).toBe(false)
  })

  it('aparece a las 14:00 y sigue hasta que se cierra', () => {
    expect(shouldAskToday(new Date(2026, 9, 20, 14, 0), prefs)).toBe(true)
    expect(shouldAskToday(new Date(2026, 9, 20, 18, 0), prefs)).toBe(true)
  })

  it('más tarde lo oculta solo hasta el próximo horario', () => {
    const now = new Date(2026, 9, 20, 14, 5)
    const next = nextAskAt(now, prefs.times)
    expect(next).toEqual(new Date(2026, 9, 20, 21, 30))
    const hidden = { ...prefs, hiddenUntil: next.toISOString() }
    expect(shouldAskToday(new Date(2026, 9, 20, 18, 0), hidden)).toBe(false)
    expect(shouldAskToday(new Date(2026, 9, 20, 21, 30), hidden)).toBe(true)
    expect(laterCopy(now, next)).toBe('Te lo vuelvo a mostrar a las 21:30.')
  })

  it('después del último horario, el próximo es mañana', () => {
    const now = new Date(2026, 9, 20, 22, 0)
    const next = nextAskAt(now, prefs.times)
    expect(next).toEqual(new Date(2026, 9, 21, 14, 0))
    expect(laterCopy(now, next)).toBe('Te lo vuelvo a mostrar mañana a las 14:00.')
  })

  it('elige el horario siguiente cuando hay más de dos', () => {
    const now = new Date(2026, 9, 20, 15, 0)
    expect(nextAskAt(now, ['14:00', '18:00', '21:30'])).toEqual(new Date(2026, 9, 20, 18, 0))
    expect(nextTimeSlot(['14:00', '21:30'])).toBe('22:30')
  })

  it('no gasté nada no vuelve a preguntar en el día', () => {
    const reviewed = { ...prefs, reviewedOn: '2026-10-20' }
    expect(shouldAskToday(new Date(2026, 9, 20, 21, 40), reviewed)).toBe(false)
    expect(shouldAskToday(new Date(2026, 9, 21, 14, 0), reviewed)).toBe(true)
    expect(shouldAskToday(new Date(2026, 9, 20, 18, 0), prefs, { logged: false, clear: true })).toBe(false)
  })

  it('si ya anotó hoy, no vuelve a preguntar', () => {
    expect(shouldAskToday(new Date(2026, 9, 20, 18, 0), prefs, { logged: true, clear: false })).toBe(false)
  })

  it('el switch apagado no muestra la tarjeta', () => {
    expect(shouldAskToday(new Date(2026, 9, 20, 21, 40), { ...prefs, enabled: false })).toBe(false)
  })

  it('exige horarios distintos', () => {
    expect(timesValid(['14:00', '21:30'])).toBe(true)
    expect(timesValid(['21:30', '14:00'])).toBe(true)
    expect(timesValid(['14:00', '14:00'])).toBe(false)
    expect(timesValid([])).toBe(false)
  })

  it('el texto de abajo usa los horarios elegidos', () => {
    expect(reminderFootnote(prefs)).toContain('14:00')
    expect(reminderFootnote(prefs)).toContain('21:30')
    expect(reminderFootnote(prefs)).toContain('todavía no se envían')
    expect(reminderFootnote({ ...prefs, enabled: false, times: ['09:00', '18:00'] })).toContain('apagado')
  })

  it('cuenta los días seguidos anotando', () => {
    expect(loggingStreak(['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19'], '2026-10-20')).toBe(5)
    expect(loggingStreak(['2026-10-18', '2026-10-19', '2026-10-20'], '2026-10-20')).toBe(3)
    expect(loggingStreak(['2026-10-17', '2026-10-19'], '2026-10-20')).toBe(1)
    expect(streakCopy(5)).toBe('5 días seguidos anotando')
    expect(streakCopy(1)).toBe('1 día seguido anotando')
  })
})
