import { describe, expect, it } from 'vitest'
import {
  GRAM_SHORTCUTS,
  conflictMessage,
  formatRecipePortionsLabel,
  incompleteNote,
  macrosForPortions,
  macrosPerServing,
  normalizeIngredientGrams,
  recipeCardMeta,
  recipeTotals,
  rescaleLoggedRecipe,
  stepIngredientGrams,
  stepRecipePortions,
  stepRecipeServings,
} from './recipes.ts'

const pizza = [
  { name: 'Harina', grams: 480, proteinG: 48, carbsG: 346, fatG: 5, kcal: 1621 },
  { name: 'Muzzarella', grams: 400, proteinG: 93, carbsG: 8, fatG: 80, kcal: 1124 },
  { name: 'Salsa', grams: 200, proteinG: 3, carbsG: 20, fatG: 1, kcal: 101 },
  { name: 'Aceite', grams: 26, proteinG: 0, carbsG: 0, fatG: 26, kcal: 234 },
  { name: 'Aceitunas', grams: 40, proteinG: 0, carbsG: 2, fatG: 8, kcal: 80 },
]

describe('cálculo por porción (RC11, ejemplo Mi pizza)', () => {
  it('suma el total y divide por 8', () => {
    const total = recipeTotals(pizza)
    expect(total.proteinG).toBe(144)
    expect(total.carbsG).toBe(376)
    expect(total.fatG).toBe(120)
    expect(total.incompleteCount).toBe(0)
    expect(macrosPerServing(pizza, 8)).toMatchObject({
      proteinG: 18,
      carbsG: 47,
      fatG: 15,
      kcal: 395,
    })
  })

  it('escala 2 porciones', () => {
    expect(macrosForPortions(pizza, 8, 2)).toEqual({
      proteinG: 36,
      carbsG: 94,
      fatG: 30,
      kcal: 790,
    })
  })

  it('cuenta ingredientes incompletos (RC10)', () => {
    const withGap = [
      ...pizza,
      { name: 'Sin dato', grams: 50, proteinG: 2, carbsG: null, fatG: null, kcal: null },
    ]
    const totals = recipeTotals(withGap)
    expect(totals.incompleteCount).toBe(1)
    expect(totals.proteinG).toBe(146)
    expect(incompleteNote(1)).toBe('Sin contar 1 ingrediente sin datos.')
  })
})

describe('pasos (RC5, RC8, RC13)', () => {
  it('gramos de a 10 con mínimo 1', () => {
    expect(stepIngredientGrams(10, -10)).toBe(1)
    expect(stepIngredientGrams(100, 10)).toBe(110)
    expect(normalizeIngredientGrams(47)).toBe(47)
    expect(GRAM_SHORTCUTS).toEqual([50, 100, 150])
  })

  it('porciones que rinde de a 1 entre 1 y 50', () => {
    expect(stepRecipeServings(1, -1)).toBe(1)
    expect(stepRecipeServings(8, 1)).toBe(9)
    expect(stepRecipeServings(50, 1)).toBe(50)
  })

  it('porciones comidas de a ½', () => {
    expect(stepRecipePortions(1, -0.5)).toBe(0.5)
    expect(stepRecipePortions(0.5, -0.5)).toBe(0.5)
    expect(formatRecipePortionsLabel(0.5)).toBe('½ porción')
    expect(formatRecipePortionsLabel(1.5)).toBe('1 ½ porciones')
    expect(formatRecipePortionsLabel(2)).toBe('2 porciones')
  })
})

describe('RC16 y textos', () => {
  it('reescala una meal con los valores guardados en la fila', () => {
    expect(
      rescaleLoggedRecipe(
        { proteinG: 36, carbsG: 94, fatG: 30, kcal: 790, portionQty: 2 },
        1,
      ),
    ).toEqual({ proteinG: 18, carbsG: 47, fatG: 15, kcal: 395 })
  })

  it('arma meta de tarjeta y aviso de conflicto', () => {
    expect(recipeCardMeta({ servings: 8, ingredientCount: 5 })).toBe(
      'Rinde 8 porciones · 5 ingredientes',
    )
    expect(conflictMessage('Maru')).toBe('Maru cambió esta receta mientras la editabas')
  })
})
