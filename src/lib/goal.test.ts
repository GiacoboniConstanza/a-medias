import { describe, expect, it } from 'vitest'
import { formatMoney } from './format.ts'
import {
  evenMonthlyShare,
  goalPaceLine,
  goalStatusLine,
  monthsUntil,
  monthlyOwnShare,
  shareLabel,
} from './goal.ts'

const nov = new Date('2026-11-10T12:00:00')

describe('ritmo de la meta', () => {
  it('cuenta meses inclusive (mes actual + mes de la fecha)', () => {
    expect(monthsUntil('2027-03-15', nov)).toBe(5)
    expect(monthsUntil('2027-01-15', nov)).toBe(3)
    expect(monthsUntil('2026-12-01', nov)).toBe(2)
    expect(monthsUntil('2026-11-20', nov)).toBe(1)
    expect(monthsUntil('2026-10-01', nov)).toBe(0)
    expect(monthsUntil('2026-09-01', nov)).toBe(-1)
  })

  it('cruza de año', () => {
    expect(monthsUntil('2027-01-01', new Date('2026-12-05'))).toBe(2)
    expect(monthsUntil('2028-02-01', new Date('2026-11-10'))).toBe(16)
  })

  it('calcula aporte mensual personal y compartido', () => {
    expect(monthlyOwnShare(380_000, 2)).toBe(190_000)
    expect(evenMonthlyShare(380_000, 2)).toBe(95_000)
    expect(monthlyOwnShare(100, 3)).toBe(33.34)
    expect(evenMonthlyShare(100, 3)).toBe(16.67)
    expect(monthlyOwnShare(0, 5)).toBeNull()
    expect(evenMonthlyShare(100, 0)).toBeNull()
  })

  it('arma la línea de ritmo compartida (legado)', () => {
    expect(goalPaceLine('2027-01-15', 3, 95_000)).toMatch(/Si cada una suma/)
    expect(shareLabel(250_000, 440_000)).toBe('57%')
  })

  it('detalle personal: ritmo y bordes', () => {
    const base = {
      isShared: false,
      target: 400_000,
      targetDate: '2027-03-15',
      balance: 100_000,
      today: nov,
      variant: 'detail' as const,
    }
    expect(goalStatusLine(base)?.text).toBe(
      `Separá ${formatMoney(monthlyOwnShare(300_000, 5)!)} por mes para llegar.`,
    )
    expect(goalStatusLine({ ...base, balance: 400_000 })?.text).toBe('¡Llegaste a la meta!')
    expect(goalStatusLine({ ...base, targetDate: '2026-11-15' })?.text).toBe(
      `Te faltan ${formatMoney(300_000)} para este mes.`,
    )
    const past = goalStatusLine({ ...base, targetDate: '2026-10-01' })
    expect(past?.text).toBe(`La fecha ya pasó. Te faltan ${formatMoney(300_000)}.`)
    expect(past?.editGoal).toBe(true)
    expect(
      goalStatusLine({ ...base, balance: 500_000, targetDate: '2026-10-01' })?.text,
    ).toBe('¡Llegaste a la meta!')
  })

  it('detalle compartido: ritmo y bordes', () => {
    const base = {
      isShared: true,
      target: 400_000,
      targetDate: '2027-03-15',
      balance: 100_000,
      today: nov,
      variant: 'detail' as const,
    }
    expect(goalStatusLine(base)?.text).toBe(
      `Si cada una suma ${formatMoney(evenMonthlyShare(300_000, 5)!)} por mes, llegan.`,
    )
    expect(goalStatusLine({ ...base, balance: 400_000 })?.text).toBe('¡Llegaron a la meta!')
    expect(goalStatusLine({ ...base, targetDate: '2026-11-15' })?.text).toBe(
      `Les faltan ${formatMoney(300_000)} para este mes.`,
    )
    const past = goalStatusLine({ ...base, targetDate: '2026-09-01' })
    expect(past?.text).toBe(`La fecha ya pasó. Les faltan ${formatMoney(300_000)}.`)
    expect(past?.editGoal).toBe(true)
  })

  it('lista: para mes · monto, o borde sin enlace', () => {
    const line = goalStatusLine({
      isShared: false,
      target: 400_000,
      targetDate: '2027-03-15',
      balance: 100_000,
      today: nov,
      variant: 'list',
    })
    expect(line?.text).toMatch(/^para marzo · /)
    expect(line?.text).toContain('por mes')
    expect(line?.editGoal).toBe(false)

    const past = goalStatusLine({
      isShared: true,
      target: 100_000,
      targetDate: '2026-10-01',
      balance: 10_000,
      today: nov,
      variant: 'list',
    })
    expect(past?.text).toMatch(/La fecha ya pasó/)
    expect(past?.editGoal).toBe(false)

    expect(
      goalStatusLine({
        isShared: false,
        target: null,
        targetDate: '2027-03-15',
        balance: 0,
        today: nov,
      }),
    ).toBeNull()
  })
})
