import { describe, expect, it } from 'vitest'
import {
  DEFAULT_REMINDER_PREFS,
  laterCopy,
  nextAskAt,
  reminderFootnote,
  reminderTimesValid,
  shouldAskToday,
} from './reminders.ts'

const prefs = { ...DEFAULT_REMINDER_PREFS }

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
    const next = nextAskAt(now, prefs.firstTime, prefs.secondTime)
    expect(next).toEqual(new Date(2026, 9, 20, 21, 30))
    const hidden = { ...prefs, hiddenUntil: next.toISOString() }
    expect(shouldAskToday(new Date(2026, 9, 20, 18, 0), hidden)).toBe(false)
    expect(shouldAskToday(new Date(2026, 9, 20, 21, 30), hidden)).toBe(true)
    expect(laterCopy(now, next)).toBe('Te lo vuelvo a mostrar a las 21:30.')
  })

  it('después del último horario, el próximo es mañana', () => {
    const now = new Date(2026, 9, 20, 22, 0)
    const next = nextAskAt(now, prefs.firstTime, prefs.secondTime)
    expect(next).toEqual(new Date(2026, 9, 21, 14, 0))
    expect(laterCopy(now, next)).toBe('Te lo vuelvo a mostrar mañana a las 14:00.')
  })

  it('no gasté nada no vuelve a preguntar en el día', () => {
    const reviewed = { ...prefs, reviewedOn: '2026-10-20' }
    expect(shouldAskToday(new Date(2026, 9, 20, 21, 40), reviewed)).toBe(false)
    expect(shouldAskToday(new Date(2026, 9, 21, 14, 0), reviewed)).toBe(true)
  })

  it('el switch apagado no muestra la tarjeta', () => {
    expect(shouldAskToday(new Date(2026, 9, 20, 21, 40), { ...prefs, enabled: false })).toBe(false)
  })

  it('exige dos horarios distintos y ordenados', () => {
    expect(reminderTimesValid('14:00', '21:30')).toBe(true)
    expect(reminderTimesValid('21:30', '14:00')).toBe(false)
    expect(reminderTimesValid('14:00', '14:00')).toBe(false)
  })

  it('el texto de abajo usa los horarios elegidos', () => {
    expect(reminderFootnote(prefs)).toContain('14:00')
    expect(reminderFootnote(prefs)).toContain('21:30')
    expect(reminderFootnote(prefs)).toContain('todavía no se envían')
    expect(reminderFootnote({ ...prefs, enabled: false, firstTime: '09:00', secondTime: '18:00' })).toContain('apagado')
  })
})
