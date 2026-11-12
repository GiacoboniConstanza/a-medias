import { describe, expect, it } from 'vitest'
import {
  argentinaISO,
  compositionPhrase,
  compositionShares,
  dayCaloriesLabel,
  dayTotals,
  formatAmount,
  fruitScale,
  hasCompositionData,
  kcalFromGrams,
  mealTypeForContext,
  proteinPercent,
  recentFromMeals,
  resolvedKcal,
  roundMacro,
  scaleByQuantity,
  scalePer100,
  shiftArgentinaISO,
  stepQuantity,
} from './meals.ts'

describe('totales del día (R16)', () => {
  it('suma proteína de todos; barra y calorías solo de los completos', () => {
    expect(
      dayTotals([
        { proteinG: 18, carbsG: 30, fatG: 8, kcal: 380 },
        { proteinG: 38, carbsG: 40, fatG: null, kcal: null },
        { proteinG: 6, carbsG: null, fatG: 10, kcal: null },
      ]),
    ).toEqual({
      protein: 62,
      carbs: 30,
      fat: 8,
      kcal: 380,
      incompleteCount: 2,
      incompleteProtein: 44,
    })
  })

  it('los ejemplos del día cierran en 52 g y 1.097 calorías', () => {
    const today = [
      { proteinG: 4, carbsG: 6, fatG: 4, kcal: 76 },
      { proteinG: 5, carbsG: 33, fatG: 1, kcal: 161 },
      { proteinG: 1, carbsG: 1, fatG: 4, kcal: 44 },
      { proteinG: 30, carbsG: 15, fatG: 10, kcal: 270 },
      { proteinG: 4, carbsG: 35, fatG: 4, kcal: 192 },
      { proteinG: 2, carbsG: 5, fatG: 5, kcal: 73 },
      { proteinG: 5, carbsG: 26, fatG: 5, kcal: 169 },
      { proteinG: 1, carbsG: 27, fatG: 0, kcal: 112 },
    ]
    const totals = dayTotals(today)
    expect(totals.protein).toBe(52)
    expect(totals.kcal).toBe(1097)
    expect(compositionPhrase(compositionShares(today))).toBe('Más de la mitad, hidratos.')
  })
})

describe('cálculo de kcal (4-4-9)', () => {
  it('usa 4P + 4C + 9G cuando está completo y kcal vacío', () => {
    expect(resolvedKcal({ proteinG: 10, carbsG: 20, fatG: 5, kcal: null })).toBe(4 * 10 + 4 * 20 + 9 * 5)
    expect(kcalFromGrams(10, 20, 5)).toBe(165)
  })

  it('no inventa calorías si faltan hidratos o grasas (R16)', () => {
    expect(resolvedKcal({ proteinG: 10, carbsG: null, fatG: 5, kcal: null })).toBeNull()
    expect(resolvedKcal({ proteinG: 35, carbsG: null, fatG: null, kcal: 520 })).toBeNull()
    expect(hasCompositionData({ proteinG: 35, carbsG: null, fatG: null, kcal: 520 })).toBe(false)
  })

  it('respeta las kcal cargadas cuando está completo', () => {
    expect(resolvedKcal({ proteinG: 10, carbsG: 20, fatG: 5, kcal: 100 })).toBe(100)
  })
})

describe('frase y barra de composición (R19)', () => {
  it('reparte porcentajes por calorías y corrige el redondeo a 100', () => {
    const shares = compositionShares([
      { proteinG: 52, carbsG: 148, fatG: 33, kcal: 1097 },
    ])
    expect(shares).toMatchObject({
      proteinPct: 19,
      carbsPct: 54,
      fatPct: 27,
      dominant: 'hidratos',
    })
    expect(shares!.proteinPct + shares!.carbsPct + shares!.fatPct).toBe(100)
    expect(compositionPhrase(shares)).toBe('Más de la mitad, hidratos.')
  })

  it('elige la frase según el umbral', () => {
    expect(
      compositionPhrase(
        compositionShares([{ proteinG: 10, carbsG: 80, fatG: 0, kcal: null }]),
      ),
    ).toBe('Casi todo hidratos.')
    expect(
      compositionPhrase(
        compositionShares([{ proteinG: 30, carbsG: 15, fatG: 10, kcal: null }]),
      ),
    ).toBe('Bastante parejo, con más proteína.')
  })
})

describe('porciones y redondeo (R7, R22, R27)', () => {
  it('escala cada 100 g y redondea al anotar', () => {
    expect(scalePer100({ protein: 20, carbs: 10, fat: 6.7 }, 150)).toEqual({
      proteinG: 30,
      carbsG: 15,
      fatG: 10,
      kcal: 270,
    })
    expect(roundMacro(0.4)).toBe(0)
    expect(roundMacro(0.6)).toBe(1)
    expect(formatAmount(52.6)).toBe('53')
  })

  it('multiplica la porción base por la cantidad', () => {
    expect(scaleByQuantity({ proteinG: 30, carbsG: 15, fatG: 10, kcal: 270 }, 0.5)).toEqual({
      proteinG: 15,
      carbsG: 8,
      fatG: 5,
      kcal: 137,
    })
    expect(stepQuantity(1, 0.5, 'portion')).toBe(1.5)
    expect(stepQuantity(100, 10, 'grams')).toBe(110)
  })
})

describe('recientes y comida por hora (R2, R9)', () => {
  it('deduplica por nombre y deja los 20 más recientes', () => {
    const rows = [
      recent('Banana', '2026-11-12T18:00:00Z'),
      recent('Café', '2026-11-12T17:00:00Z'),
      recent('banana', '2026-11-11T10:00:00Z'),
      recent('Arroz', '2026-11-10T10:00:00Z'),
    ]
    expect(recentFromMeals(rows).map((row) => row.name)).toEqual(['Banana', 'Café', 'Arroz'])
  })

  it('elige almuerzo fuera de hoy y según la hora en hoy', () => {
    expect(mealTypeForContext('2026-11-11', new Date('2026-11-12T16:00:00.000Z'))).toBe('almuerzo')
    // 13:40 Argentina = 16:40 UTC en noviembre (UTC-3)
    expect(mealTypeForContext('2026-11-12', new Date('2026-11-12T16:40:00.000Z'))).toBe('almuerzo')
    expect(mealTypeForContext('2026-11-12', new Date('2026-11-12T12:00:00.000Z'))).toBe('desayuno')
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

  it('etiqueta de calorías del día (R20)', () => {
    expect(dayCaloriesLabel(1097, 0, 0)).toBe('1.097 calorías hoy.')
    expect(dayCaloriesLabel(548, -1, 2)).toBe('548 calorías ayer, sin lo cargado a mano.')
    expect(dayCaloriesLabel(0, 0, 0)).toBe('0 calorías hoy.')
  })
})

function recent(name: string, createdAt: string) {
  return {
    name,
    proteinG: 1,
    carbsG: 1,
    fatG: 0,
    kcal: 20,
    portionLabel: '1',
    portionQty: 1,
    portionGrams: 100,
    foodSource: 'common' as const,
    foodRef: null,
    brand: null,
    createdAt,
  }
}
