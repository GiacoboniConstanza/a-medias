export const MEAL_TYPES = ['desayuno', 'almuerzo', 'merienda', 'cena', 'snack'] as const

export type MealType = (typeof MEAL_TYPES)[number]

export const MEAL_LABEL: Record<MealType, string> = {
  desayuno: 'Desayuno',
  almuerzo: 'Almuerzo',
  merienda: 'Merienda',
  cena: 'Cena',
  snack: 'Colación',
}

export const MEAL_ICON: Record<MealType, string> = {
  desayuno: 'mug-hot',
  almuerzo: 'utensils',
  merienda: 'cookie',
  cena: 'bowl-food',
  snack: 'apple-whole',
}

export type FoodSource = 'common' | 'off' | 'manual' | 'saved'

export type FoodPortion = {
  label: string
  grams: number
  suggested?: boolean
}

export type MacroInput = {
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
  kcal: number | null
}

export type DayTotals = {
  protein: number
  carbs: number
  fat: number
  kcal: number
  /** Alimentos sin hidratos o grasas (no entran en barra ni calorías). */
  incompleteCount: number
  /** Proteína de esos alimentos incompletos. */
  incompleteProtein: number
}

export type CompositionPart = 'proteína' | 'hidratos' | 'grasas'

export type CompositionShares = {
  proteinPct: number
  carbsPct: number
  fatPct: number
  proteinG: number
  carbsG: number
  fatG: number
  kcal: number
  dominant: CompositionPart
}

const ARGENTINA = 'America/Argentina/Buenos_Aires'

export const ARGENFOODS_ATTR = 'Datos: ARGENFOODS, Universidad Nacional de Luján.'
export const ARGENFOODS_ATTR_SHORT = 'Datos: ARGENFOODS, Universidad Nacional de Luján'
export const OFF_ATTR = 'Datos de productos: Open Food Facts.'

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

/** Hora local de Argentina 0–23. */
export function argentinaHour(date = new Date()): number {
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone: ARGENTINA,
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(date).find((part) => part.type === 'hour')?.value
  return Number(hour ?? 0)
}

/** R2: comida según la hora. Colación nunca viene elegida. Otro día → almuerzo. */
export function mealTypeForContext(eatenOn: string, now = new Date()): MealType {
  if (eatenOn !== argentinaISO(now)) return 'almuerzo'
  const hour = argentinaHour(now)
  if (hour >= 5 && hour < 11) return 'desayuno'
  if (hour >= 11 && hour < 16) return 'almuerzo'
  if (hour >= 16 && hour < 20) return 'merienda'
  return 'cena'
}

/** Tiene los tres macros para barra y calorías (R16). */
export function hasCompositionData(meal: MacroInput): boolean {
  return meal.proteinG != null && meal.carbsG != null && meal.fatG != null
}

/** Legacy: anotado a mano sin porción ni origen (R16). */
export function isManualLegacy(meal: {
  foodSource?: FoodSource | null
  portionLabel?: string | null
  portionGrams?: number | null
}): boolean {
  return meal.foodSource == null && meal.portionLabel == null && meal.portionGrams == null
}

/** 4P + 4C + 9G. Solo con macros completos; si hay kcal propia y está completo, se usa. */
export function resolvedKcal(meal: MacroInput): number | null {
  if (!hasCompositionData(meal)) return null
  if (meal.kcal != null && Number.isFinite(meal.kcal)) return meal.kcal
  return 4 * (meal.proteinG as number) + 4 * (meal.carbsG as number) + 9 * (meal.fatG as number)
}

export function kcalFromGrams(proteinG: number, carbsG: number, fatG: number): number {
  return 4 * proteinG + 4 * carbsG + 9 * fatG
}

export function dayTotals(meals: readonly MacroInput[]): DayTotals {
  return meals.reduce<DayTotals>(
    (sum, meal) => {
      const complete = hasCompositionData(meal)
      const protein = meal.proteinG ?? 0
      return {
        protein: sum.protein + protein,
        carbs: sum.carbs + (complete ? (meal.carbsG as number) : 0),
        fat: sum.fat + (complete ? (meal.fatG as number) : 0),
        kcal: sum.kcal + (complete ? (resolvedKcal(meal) ?? 0) : 0),
        incompleteCount: sum.incompleteCount + (complete ? 0 : 1),
        incompleteProtein: sum.incompleteProtein + (complete ? 0 : protein),
      }
    },
    { protein: 0, carbs: 0, fat: 0, kcal: 0, incompleteCount: 0, incompleteProtein: 0 },
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

/** R22: sin decimales al mostrar. */
export function formatAmount(value: number): string {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(Math.round(value))
}

/** R27: redondear al anotar. */
export function roundMacro(value: number): number {
  return Math.round(value)
}

export function proteinLabel(eaten: number, goal: number | null): string {
  if (goal == null || goal <= 0) return `${formatAmount(eaten)} g de proteína`
  return `${formatAmount(eaten)} de ${formatAmount(goal)} g de proteína`
}

export function proteinRemainingLabel(eaten: number, goal: number | null): string {
  if (goal == null || goal <= 0) return 'Sin objetivo.'
  const left = goal - eaten
  if (left <= 0) return 'Llegaste a tu objetivo.'
  return `Te faltan ${formatAmount(left)} g.`
}

export function dayCaloriesLabel(kcal: number, offset: -1 | 0 | 1, incompleteCount: number): string {
  const when = offset === -1 ? 'ayer' : offset === 1 ? 'mañana' : 'hoy'
  const base = `${formatAmount(kcal)} calorías ${when}.`
  if (offset === -1 && incompleteCount > 0) {
    return `${formatAmount(kcal)} calorías ayer, sin lo cargado a mano.`
  }
  return base
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

export function isFoodSource(value: string | null | undefined): value is FoodSource {
  return value === 'common' || value === 'off' || value === 'manual' || value === 'saved'
}

/** Escala macros cada 100 g a una porción en gramos; redondea (R27). */
export function scalePer100(
  per100: { protein: number | null; carbs: number | null; fat: number | null; kcal?: number | null },
  grams: number,
): MacroInput {
  const factor = grams / 100
  const proteinG = per100.protein == null ? null : roundMacro(per100.protein * factor)
  const carbsG = per100.carbs == null ? null : roundMacro(per100.carbs * factor)
  const fatG = per100.fat == null ? null : roundMacro(per100.fat * factor)
  let kcal: number | null = null
  if (proteinG != null && carbsG != null && fatG != null) {
    kcal = roundMacro(kcalFromGrams(proteinG, carbsG, fatG))
  } else if (per100.kcal != null) {
    kcal = roundMacro(per100.kcal * factor)
  }
  return { proteinG, carbsG, fatG, kcal }
}

/** Multiplica macros de una porción base por la cantidad (pasos de ½). */
export function scaleByQuantity(base: MacroInput, qty: number): MacroInput {
  const mul = (value: number | null) => (value == null ? null : roundMacro(value * qty))
  const proteinG = mul(base.proteinG)
  const carbsG = mul(base.carbsG)
  const fatG = mul(base.fatG)
  let kcal = mul(base.kcal)
  if (proteinG != null && carbsG != null && fatG != null) {
    kcal = roundMacro(kcalFromGrams(proteinG, carbsG, fatG))
  }
  return { proteinG, carbsG, fatG, kcal }
}

export function compositionShares(meals: readonly MacroInput[]): CompositionShares | null {
  const complete = meals.filter(hasCompositionData)
  if (complete.length === 0) return null
  const proteinG = complete.reduce((sum, meal) => sum + (meal.proteinG as number), 0)
  const carbsG = complete.reduce((sum, meal) => sum + (meal.carbsG as number), 0)
  const fatG = complete.reduce((sum, meal) => sum + (meal.fatG as number), 0)
  const proteinKcal = 4 * proteinG
  const carbsKcal = 4 * carbsG
  const fatKcal = 9 * fatG
  const total = proteinKcal + carbsKcal + fatKcal
  if (total <= 0) return null
  const raw = [
    { part: 'proteína' as const, kcal: proteinKcal, grams: proteinG },
    { part: 'hidratos' as const, kcal: carbsKcal, grams: carbsG },
    { part: 'grasas' as const, kcal: fatKcal, grams: fatG },
  ]
  const rounded = raw.map((item) => ({
    ...item,
    pct: Math.round((item.kcal / total) * 100),
  }))
  const drift = 100 - rounded.reduce((sum, item) => sum + item.pct, 0)
  if (drift !== 0) {
    const biggest = [...rounded].sort((a, b) => b.kcal - a.kcal || b.pct - a.pct)[0]
    if (biggest) biggest.pct += drift
  }
  const byPart = Object.fromEntries(rounded.map((item) => [item.part, item.pct])) as Record<
    CompositionPart,
    number
  >
  const dominant = [...rounded].sort((a, b) => b.pct - a.pct || b.kcal - a.kcal)[0]?.part ?? 'proteína'
  return {
    proteinPct: byPart.proteína,
    carbsPct: byPart.hidratos,
    fatPct: byPart.grasas,
    proteinG,
    carbsG,
    fatG,
    kcal: roundMacro(proteinKcal + carbsKcal + fatKcal),
    dominant,
  }
}

/** R19: frase según la parte más grande. */
export function compositionPhrase(shares: CompositionShares | null): string {
  if (!shares) return ''
  const part = shares.dominant
  const pct =
    part === 'proteína' ? shares.proteinPct : part === 'hidratos' ? shares.carbsPct : shares.fatPct
  if (pct >= 70) return `Casi todo ${part}.`
  if (pct >= 50) return `Más de la mitad, ${part}.`
  return `Bastante parejo, con más ${part}.`
}

export function compositionAriaLabel(shares: CompositionShares, scope = 'tu día'): string {
  return `De qué estuvo hecho ${scope}: proteína ${shares.proteinPct} %, hidratos ${shares.carbsPct} %, grasas ${shares.fatPct} %`
}

/** `grams` es el total ya aplicado (como se guarda en `portion_grams`). */
export function portionDisplay(input: {
  label?: string | null
  qty?: number | null
  grams?: number | null
  manual?: boolean
}): string {
  if (input.manual && !input.label) return '1 porción'
  const label = (input.label ?? 'porción').trim()
  const qty = input.qty != null && input.qty !== 1 ? formatPortionQty(input.qty) : null
  const head = qty
    ? `${qty} ${label.toLowerCase()}`
    : /^(\d|½)/.test(label)
      ? label
      : `1 ${label.toLowerCase()}`
  if (input.grams != null && input.grams > 0) {
    return `${head} (${formatAmount(input.grams)} g)`
  }
  return head
}

export function formatPortionQty(qty: number): string {
  if (Number.isInteger(qty)) return String(qty)
  const rounded = Math.round(qty * 2) / 2
  if (rounded === 0.5) return '½'
  if (Number.isInteger(rounded)) return String(rounded)
  return String(rounded).replace('.', ',')
}

export function foodRowSubtitle(input: {
  label?: string | null
  qty?: number | null
  grams?: number | null
  proteinG: number | null
  foodSource?: FoodSource | null
  manualLegacy?: boolean
}): string {
  const manual = input.manualLegacy || input.foodSource === 'manual'
  const portion = portionDisplay({
    label: input.label,
    qty: input.qty,
    grams: input.grams,
    manual: Boolean(manual && !input.label),
  })
  const protein =
    input.proteinG == null ? null : `${formatAmount(input.proteinG)} g de proteína`
  if (manual && !input.label && protein) return `${portion} · ${protein} · a mano`
  if (protein) return `${portion} · ${protein}`
  return portion
}

export type RecentFood = {
  name: string
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
  kcal: number | null
  portionLabel: string | null
  portionQty: number | null
  portionGrams: number | null
  foodSource: FoodSource | null
  foodRef: string | null
  brand: string | null
  createdAt: string
}

/** R9: últimos 20 alimentos distintos por nombre (más reciente primero). */
export function recentFromMeals<T extends RecentFood>(meals: readonly T[], limit = 20): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const meal of meals) {
    const key = meal.name.trim().toLocaleLowerCase('es')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(meal)
    if (out.length >= limit) break
  }
  return out
}

export function normalizeSearch(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

export function matchesSearch(name: string, query: string): boolean {
  const q = normalizeSearch(query)
  if (!q) return true
  return normalizeSearch(name).includes(q)
}

export function topContributors(
  meals: readonly { name: string; proteinG: number | null; carbsG: number | null; fatG: number | null }[],
  part: CompositionPart,
  limit = 2,
): string[] {
  const key = part === 'proteína' ? 'proteinG' : part === 'hidratos' ? 'carbsG' : 'fatG'
  return [...meals]
    .filter((meal) => (meal[key] ?? 0) > 0)
    .sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0))
    .slice(0, limit)
    .map((meal) => meal.name)
}

export function moreThanAnythingLabel(names: string[]): string {
  if (names.length === 0) return ''
  if (names.length === 1) return `Más que nada: ${names[0]}.`
  return `Más que nada: ${names[0]} y ${names[1]}.`
}

export function addedSummaryNames(names: string[]): string {
  if (names.length <= 3) {
    if (names.length === 0) return ''
    if (names.length === 1) return names[0]
    if (names.length === 2) return `${names[0]} y ${names[1]}`
    return `${names[0]}, ${names[1]} y ${names[2]}`
  }
  return `${names[0]}, ${names[1]} y ${names.length - 2} más.`
}

export function stepQuantity(current: number, delta: 0.5 | -0.5 | 10 | -10, mode: 'portion' | 'grams'): number {
  const next = current + delta
  if (mode === 'grams') return Math.max(1, roundMacro(next))
  return Math.max(0.5, Math.round(next * 2) / 2)
}

export function formatLongDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day, 15))
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: ARGENTINA,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date)
}

export function compositionSheetSubtitle(offset: -1 | 0 | 1, iso: string): string {
  const long = formatLongDate(iso)
  if (offset === 0) return `Hoy, ${long}`
  if (offset === -1) return `Ayer, ${long}`
  return `Mañana, ${long}`
}
