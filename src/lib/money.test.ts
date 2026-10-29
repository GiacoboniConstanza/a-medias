import { describe, expect, it } from 'vitest'
import { monthPocket } from './derive.ts'
import { formatMoney } from './format.ts'
import { gustosStatus } from './gustos.ts'
import { iconByName, ICON_CHOICES, DEFAULT_ICON } from './icons.ts'
import { jarStatus } from './jar.ts'
import { monthTitle } from './month.ts'
import { debtSentence, splitShared } from './split.ts'

describe('reparto del boceto', () => {
  const result = splitShared(352_000, [
    { id: 'coty', name: 'Coty', base: 900_000, paid: 295_200 },
    { id: 'maru', name: 'Maru', base: 600_000, paid: 56_800 },
  ])

  it('parte 60/40 según el sueldo base', () => {
    expect(result.rows.map((row) => row.percent)).toEqual([60, 40])
    expect(result.rows.map((row) => row.share)).toEqual([211_200, 140_800])
    expect(result.amount).toBe(84_000)
    expect(result.usedEvenSplit).toBe(false)
  })

  it('dice quién le debe a quién', () => {
    expect(debtSentence('coty', result)).toBe('Maru te debe $ 84.000')
    expect(debtSentence('maru', result)).toBe('Le debés $ 84.000 a Coty')
  })
})

describe('bolsa de gustos', () => {
  it('avisa cuando queda un cuarto o menos', () => {
    const status = gustosStatus(90_000, 72_000)
    expect(status.level).toBe('low')
    expect(status.remaining).toBe(18_000)
  })

  it('marca cuando el gasto ya entra en los fondos', () => {
    expect(gustosStatus(90_000, 100_000).level).toBe('over')
  })
})

describe('frasco', () => {
  it('pide el sueldo base si todavía no está', () => {
    const status = jarStatus({
      base: 0,
      privateSpent: 0,
      myShare: 0,
      dayOfMonth: 16,
      daysInMonth: 31,
      isCurrentMonth: true,
    })
    expect(status.tone).toBe('empty')
  })

  it('se pone rojo si el gasto se pasó del sueldo', () => {
    const status = jarStatus({
      base: 100_000,
      privateSpent: 80_000,
      myShare: 40_000,
      dayOfMonth: 10,
      daysInMonth: 31,
      isCurrentMonth: true,
    })
    expect(status.tone).toBe('red')
    expect(status.remaining).toBe(-20_000)
  })
})

describe('inicio del mes', () => {
  it('resta privados y la parte compartida, y deja los extras en la bolsa', () => {
    const pocket = monthPocket({ base: 900_000, privateSpent: 72_000, myShare: 211_200, extras: 300_000 })
    expect(pocket.remaining).toBe(616_800)
    expect(pocket.spent).toBe(283_200)
    expect(pocket.income).toBe(1_200_000)
  })

  it('titula el mes sin la palabra de', () => {
    expect(monthTitle('2026-10-01')).toBe('Octubre 2026')
  })

  it('usa un ícono por defecto si el nombre no está', () => {
    expect(ICON_CHOICES).toHaveLength(30)
    expect(iconByName('plane')).toBe(iconByName('plane'))
    expect(iconByName('no-existe').iconName).toBe(iconByName(DEFAULT_ICON).iconName)
    expect(iconByName('').iconName).toBe('tag')
  })
})

describe('plata', () => {
  it('usa punto de miles', () => {
    expect(formatMoney(186_400)).toBe('$ 186.400')
    expect(formatMoney(-1500)).toBe('-$ 1.500')
  })
})
