import { describe, expect, it } from 'vitest'
import { evenMonthlyShare, goalPaceLine, monthsUntil, shareLabel } from './goal.ts'

describe('ritmo de la meta', () => {
  it('calcula meses y el aporte parejo', () => {
    expect(monthsUntil('2027-01-15', new Date('2026-11-10'))).toBe(2)
    expect(evenMonthlyShare(380_000, 2)).toBe(95_000)
  })

  it('arma la línea de ritmo', () => {
    expect(goalPaceLine('2027-01-15', 2, 95_000)).toMatch(/Si cada una suma/)
    expect(shareLabel(250_000, 440_000)).toBe('57%')
  })
})
