import { describe, expect, it } from 'vitest'
import { argentinaISO, dayTotals, fruitScale, proteinPercent, resolvedKcal, shiftArgentinaISO } from './meals.ts'

describe('totales del día', () => {
  it('suma proteína, carbos, grasas y las calorías resueltas', () => {
    expect(
      dayTotals([
        { proteinG: 18, carbsG: 30, fatG: 8, kcal: 380 },
        { proteinG: 38, carbsG: 40, fatG: null, kcal: null },
        { proteinG: 6, carbsG: null, fatG: 10, kcal: null },
      ]),
    ).toEqual({
      protein: 62,
      carbs: 70,
      fat: 18,
      kcal: 380 + (4 * 38 + 4 * 40) + (4 * 6 + 9 * 10),
    })
  })
})

describe('cálculo de kcal', () => {
  it('usa 4P + 4C + 9G cuando kcal viene vacío', () => {
    expect(resolvedKcal({ proteinG: 10, carbsG: null, fatG: 5, kcal: null })).toBe(4 * 10 + 9 * 5)
    expect(resolvedKcal({ proteinG: 10, carbsG: 20, fatG: 5, kcal: null })).toBe(4 * 10 + 4 * 20 + 9 * 5)
  })

  it('respeta las kcal cargadas', () => {
    expect(resolvedKcal({ proteinG: 10, carbsG: 20, fatG: 5, kcal: 100 })).toBe(100)
  })
})

describe('porcentaje de proteína para la fruta', () => {
  it('62 de 100 es 62% y la fruta queda entre el brote y el fruto maduro', () => {
    expect(proteinPercent(62, 100)).toBe(62)
    expect(fruitScale(62)).toBeGreaterThan(fruitScale(0))
    expect(fruitScale(62)).toBeLessThan(fruitScale(100))
  })

  it('sin objetivo no hay porcentaje, y pasar la meta no agranda más el fruto', () => {
    expect(proteinPercent(40, null)).toBeNull()
    expect(proteinPercent(0, 100)).toBe(0)
    expect(fruitScale(140)).toBe(fruitScale(100))
  })

  it('el día de la comida es el de Argentina, no el UTC', () => {
    expect(argentinaISO(new Date('2026-10-28T02:30:00.000Z'))).toBe('2026-10-27')
    expect(argentinaISO(new Date('2026-10-28T03:30:00.000Z'))).toBe('2026-10-28')
    expect(shiftArgentinaISO('2026-10-28', -1)).toBe('2026-10-27')
    expect(shiftArgentinaISO('2026-10-28', 1)).toBe('2026-10-29')
  })
})
