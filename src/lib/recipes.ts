import {
  formatAmount,
  formatPortionQty,
  hasCompositionData,
  kcalFromGrams,
  roundMacro,
  scaleByQuantity,
  type FoodSource,
  type MacroInput,
} from './meals.ts'

export type RecipeIngredientSource = Extract<FoodSource, 'common' | 'off' | 'manual'>

export type RecipeIngredientInput = {
  name: string
  grams: number
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
  kcal: number | null
}

export const GRAM_STEP = 10
export const GRAM_SHORTCUTS = [50, 100, 150] as const
export const SERVINGS_MIN = 1
export const SERVINGS_MAX = 50

/** RC8: gramos de a 10, mínimo 1. */
export function stepIngredientGrams(current: number, delta: 10 | -10): number {
  return Math.max(1, roundMacro(current + delta))
}

export function normalizeIngredientGrams(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1
  return Math.max(1, roundMacro(value))
}

/** RC5: porciones que rinde, de a 1, entre 1 y 50. */
export function stepRecipeServings(current: number, delta: 1 | -1): number {
  return Math.min(SERVINGS_MAX, Math.max(SERVINGS_MIN, Math.round(current + delta)))
}

export function normalizeRecipeServings(value: number): number {
  if (!Number.isFinite(value)) return SERVINGS_MIN
  return Math.min(SERVINGS_MAX, Math.max(SERVINGS_MIN, Math.round(value)))
}

export function ingredientIsComplete(item: RecipeIngredientInput): boolean {
  return hasCompositionData({
    proteinG: item.proteinG,
    carbsG: item.carbsG,
    fatG: item.fatG,
    kcal: item.kcal,
  })
}

export function incompleteIngredientCount(ingredients: readonly RecipeIngredientInput[]): number {
  return ingredients.filter((item) => !ingredientIsComplete(item)).length
}

/** Suma proteína de lo que la tiene; barra/kcal solo de ingredientes completos (RC10). */
export function recipeTotals(ingredients: readonly RecipeIngredientInput[]): MacroInput & {
  incompleteCount: number
} {
  let proteinG: number | null = null
  let carbsG: number | null = null
  let fatG: number | null = null
  let kcal: number | null = null
  let incompleteCount = 0
  for (const item of ingredients) {
    if (item.proteinG != null) proteinG = (proteinG ?? 0) + item.proteinG
    if (ingredientIsComplete(item)) {
      carbsG = (carbsG ?? 0) + (item.carbsG as number)
      fatG = (fatG ?? 0) + (item.fatG as number)
      const itemKcal =
        item.kcal != null
          ? item.kcal
          : kcalFromGrams(item.proteinG as number, item.carbsG as number, item.fatG as number)
      kcal = (kcal ?? 0) + itemKcal
    } else {
      incompleteCount += 1
    }
  }
  if (proteinG != null && carbsG != null && fatG != null) {
    kcal = roundMacro(kcalFromGrams(proteinG, carbsG, fatG))
  } else if (kcal != null) {
    kcal = roundMacro(kcal)
  }
  return {
    proteinG: proteinG == null ? null : roundMacro(proteinG),
    carbsG: carbsG == null ? null : roundMacro(carbsG),
    fatG: fatG == null ? null : roundMacro(fatG),
    kcal,
    incompleteCount,
  }
}

/** Macros de una porción = total / servings (RC11). */
export function macrosPerServing(ingredients: readonly RecipeIngredientInput[], servings: number): MacroInput & {
  incompleteCount: number
} {
  const total = recipeTotals(ingredients)
  const safe = Math.max(SERVINGS_MIN, servings)
  const proteinG = total.proteinG == null ? null : roundMacro(total.proteinG / safe)
  const carbsG = total.carbsG == null ? null : roundMacro(total.carbsG / safe)
  const fatG = total.fatG == null ? null : roundMacro(total.fatG / safe)
  let kcal = total.kcal == null ? null : roundMacro(total.kcal / safe)
  if (proteinG != null && carbsG != null && fatG != null) {
    kcal = roundMacro(kcalFromGrams(proteinG, carbsG, fatG))
  }
  return { proteinG, carbsG, fatG, kcal, incompleteCount: total.incompleteCount }
}

/** RC13: anotar de a ½ porción, mínimo ½. */
export function stepRecipePortions(current: number, delta: 0.5 | -0.5): number {
  return Math.max(0.5, Math.round((current + delta) * 2) / 2)
}

/** Macros al anotar `qty` porciones de la receta. */
export function macrosForPortions(
  ingredients: readonly RecipeIngredientInput[],
  servings: number,
  qty: number,
): MacroInput {
  const per = macrosPerServing(ingredients, servings)
  return scaleByQuantity(
    { proteinG: per.proteinG, carbsG: per.carbsG, fatG: per.fatG, kcal: per.kcal },
    Math.max(0.5, qty),
  )
}

/** RC16: reescalar una meal ya anotada con los valores por porción guardados en la fila. */
export function rescaleLoggedRecipe(
  meal: MacroInput & { portionQty: number | null },
  newQty: number,
): MacroInput {
  const baseQty = meal.portionQty != null && meal.portionQty > 0 ? meal.portionQty : 1
  const per = scaleByQuantity(
    {
      proteinG: meal.proteinG,
      carbsG: meal.carbsG,
      fatG: meal.fatG,
      kcal: meal.kcal,
    },
    1 / baseQty,
  )
  return scaleByQuantity(per, Math.max(0.5, newQty))
}

/** Fracciones en el día: «½ porción», «1 ½ porciones» (RC13). */
export function formatRecipePortionsLabel(qty: number): string {
  const safe = Math.max(0.5, Math.round(qty * 2) / 2)
  if (safe === 0.5) return '½ porción'
  if (safe === 1) return '1 porción'
  const whole = Math.floor(safe)
  const half = safe - whole === 0.5
  if (half && whole >= 1) return `${whole} ½ porciones`
  if (Number.isInteger(safe)) return `${safe} porciones`
  return `${formatPortionQty(safe)} porciones`
}

export function recipeCardMeta(input: {
  servings: number
  ingredientCount: number
}): string {
  const portions =
    input.servings === 1 ? 'Rinde 1 porción' : `Rinde ${formatAmount(input.servings)} porciones`
  const ingredients =
    input.ingredientCount === 1 ? '1 ingrediente' : `${input.ingredientCount} ingredientes`
  return `${portions} · ${ingredients}`
}

export function incompleteNote(count: number): string | null {
  if (count <= 0) return null
  if (count === 1) return 'Sin contar 1 ingrediente sin datos.'
  return `Sin contar ${count} ingredientes sin datos.`
}

export function conflictMessage(otherName: string): string {
  const name = otherName.trim() || 'La otra'
  return `${name} cambió esta receta mientras la editabas`
}

export function deletedConflictMessage(otherName: string): string {
  const name = otherName.trim() || 'La otra'
  return `${name} borró esta receta. Si guardás, vuelve a aparecer con tus cambios.`
}

export function isRecipeFoodSource(value: string | null | undefined): value is 'recipe' {
  return value === 'recipe'
}
