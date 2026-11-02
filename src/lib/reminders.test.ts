import { describe, expect, it } from 'vitest'
import {
  DEFAULT_REMINDER_PREFS,
  laterCopy,
  loggingStreak,
  nextAskAt,
  nextTimeSlot,
  reminderFootnote,
  pendingCount,
  shouldAskToday,
  streakCopy,
  timesValid,
} from './reminders.ts'

const prefs = { ...DEFAULT_REMINDER_PREFS, times: [...DEFAULT_REMINDER_PREFS.times] }

const openFixed = (count: number) =>
  Array.from({ length: count }, () => ({ applies: true, pausedAt: null, payment: null }))

describe('pendientes de la campana', () => {
  const afternoon = new Date(2026, 9, 20, 18, 0)
  const day = { logged: false, clear: false }

  it('en cero no cuenta fijos cerrados ni el recordatorio apagado', () => {
    expect(pendingCount(afternoon, { ...prefs, enabled: false }, day, [])).toBe(0)
    expect(
      pendingCount(afternoon, { ...prefs, enabled: false }, day, [
        { applies: false, pausedAt: null, payment: null },
        { applies: true, pausedAt: '2026-10-01', payment: null },
        { applies: true, pausedAt: null, payment: { id: 'pago' } },
      ]),
    ).toBe(0)
  })

  it('cuenta de 1 a 9 y desde 10 sigue el número entero', () => {
    expect(pendingCount(afternoon, { ...prefs, enabled: false }, day, openFixed(4))).toBe(4)
    expect(pendingCount(afternoon, { ...prefs, enabled: false }, day, openFixed(9))).toBe(9)
    expect(pendingCount(afternoon, { ...prefs, enabled: false }, day, openFixed(12))).toBe(12)
  })

  it('no suma el recordatorio si está apagado o todavía no es la hora', () => {
    expect(pendingCount(afternoon, { ...prefs, enabled: false }, day, openFixed(2))).toBe(2)
    expect(pendingCount(new Date(2026, 9, 20, 13, 59), prefs, day, [])).toBe(0)
  })

  it('no suma el día si ya hay gasto, un clear o reviewedOn de hoy', () => {
    expect(pendingCount(afternoon, prefs, { logged: true, clear: false }, [])).toBe(0)
    expect(pendingCount(afternoon, prefs, { logged: false, clear: true }, [])).toBe(0)
    expect(pendingCount(afternoon, { ...prefs, reviewedOn: '2026-10-20' }, day, [])).toBe(0)
  })

  it('cerrarlo hoy lo saca hasta mañana, y un cierre de ayer no', () => {
    const closedToday = { ...prefs, hiddenUntil: new Date(2026, 9, 20, 21, 30).toISOString() }
    expect(pendingCount(new Date(2026, 9, 20, 21, 30), closedToday, day, [])).toBe(0)
    const closedYesterday = { ...prefs, hiddenUntil: new Date(2026, 9, 20, 14, 0).toISOString() }
    expect(pendingCount(afternoon, closedYesterday, day, [])).toBe(1)
  })
})

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
