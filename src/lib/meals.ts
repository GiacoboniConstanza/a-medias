export const MEAL_TYPES = ['desayuno', 'almuerzo', 'merienda', 'cena', 'snack'] as const

export type MealType = (typeof MEAL_TYPES)[number]

export const MEAL_LABEL: Record<MealType, string> = {
  desayuno: 'Desayuno',
  almuerzo: 'Almuerzo',
  merienda: 'Merienda',
  cena: 'Cena',
  snack: 'Snack',
}

export const MEAL_ICON: Record<MealType, string> = {
  desayuno: 'mug-hot',
  almuerzo: 'utensils',
  merienda: 'cookie',
  cena: 'bowl-food',
  snack: 'apple-whole',
}

const ARGENTINA = 'America/Argentina/Buenos_Aires'

export type MacroInput = {
  proteinG: number
  carbsG: number | null
  fatG: number | null
  kcal: number | null
}

export type DayTotals = {
  protein: number
  carbs: number
  fat: number
  kcal: number
}

/** Fecha calendario en Argentina, aunque el reloj de la máquina esté en UTC. */
export function argentinaISO(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ARGENTINA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value ?? '0000'
  const month = parts.find((part) => part.type === 'month')?.value ?? '01'
  const day = parts.find((part) => part.type === 'day')?.value ?? '01'
  return `${year}-${month}-${day}`
}

export function shiftArgentinaISO(iso: string, delta: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const utc = new Date(Date.UTC(year, month - 1, day + delta, 15, 0, 0))
  return argentinaISO(utc)
}

export function resolvedKcal(meal: MacroInput): number {
  if (meal.kcal != null && Number.isFinite(meal.kcal)) return meal.kcal
  const carbs = meal.carbsG ?? 0
  const fat = meal.fatG ?? 0
  return 4 * meal.proteinG + 4 * carbs + 9 * fat
}

export function dayTotals(meals: readonly MacroInput[]): DayTotals {
  return meals.reduce<DayTotals>(
    (sum, meal) => ({
      protein: sum.protein + meal.proteinG,
      carbs: sum.carbs + (meal.carbsG ?? 0),
      fat: sum.fat + (meal.fatG ?? 0),
      kcal: sum.kcal + resolvedKcal(meal),
    }),
    { protein: 0, carbs: 0, fat: 0, kcal: 0 },
  )
}

/** null si no hay objetivo de proteína. El fruto usa este porcentaje, con tope en 100 para el tamaño. */
export function proteinPercent(eaten: number, goal: number | null): number | null {
  if (goal == null || !Number.isFinite(goal) || goal <= 0) return null
  if (!Number.isFinite(eaten) || eaten <= 0) return 0
  return Math.round((eaten / goal) * 100)
}

export function fruitScale(percent: number): number {
  const clamped = Math.max(0, Math.min(percent, 100))
  return 0.35 + (clamped / 100) * 0.65
}

export function formatAmount(value: number): string {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(value)
}

export function proteinLabel(eaten: number, goal: number | null): string {
  if (goal == null || goal <= 0) return `${formatAmount(eaten)} g de proteína`
  return `${formatAmount(eaten)} de ${formatAmount(goal)} g de proteína`
}

export function foodPlantCopy(protein: number, goal: number | null): { title: string; detail: string } {
  if (goal == null || goal <= 0) {
    return {
      title: 'Tu plantita',
      detail: protein > 0 ? `Hoy sumaste ${formatAmount(protein)} g de proteína.` : 'Cuando anotes una comida, le crece el fruto.',
    }
  }
  const percent = proteinPercent(protein, goal) ?? 0
  return {
    title: percent >= 100 ? 'Tu plantita dio fruto' : 'Tu plantita',
    detail: proteinLabel(protein, goal) + '.',
  }
}

export function parseMacro(value: string): number | null {
  const trimmed = value.trim().replace(',', '.')
  if (!trimmed) return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed
}

export function isMealType(value: string): value is MealType {
  return (MEAL_TYPES as readonly string[]).includes(value)
}

export function asNumber(value: number | string | null): number | null {
  if (value == null) return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}
