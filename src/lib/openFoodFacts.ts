import type { FoodPortion, MacroInput } from './meals.ts'
import { roundMacro, scalePer100 } from './meals.ts'

/** Cliente mínimo de Open Food Facts (R5, R12, R13, R14). Sin escáner (R23). */

export const OFF_USER_AGENT = 'AMedias/1.0 (https://github.com/GiacoboniConstanza/a-medias; comidas@example.test)'

const OFF_SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl'

export type OffProduct = {
  code: string
  name: string
  brand: string | null
  proteinPer100: number | null
  carbsPer100: number | null
  fatPer100: number | null
  kcalPer100: number | null
  portions: FoodPortion[]
  missing: Array<'proteína' | 'hidratos' | 'grasas'>
}

export type OffSearchResult =
  | { ok: true; products: OffProduct[] }
  | { ok: false; error: 'timeout' | 'network' | 'http' }

type OffRawProduct = {
  code?: string
  product_name?: string
  product_name_es?: string
  brands?: string
  serving_size?: string
  serving_quantity?: number | string
  nutriments?: Record<string, number | string | undefined>
}

function num(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function parseServingGrams(product: OffRawProduct): number | null {
  const qty = num(product.serving_quantity)
  if (qty != null && qty > 0) return roundMacro(qty)
  const size = product.serving_size?.trim()
  if (!size) return null
  const match = size.match(/(\d+(?:[.,]\d+)?)\s*g\b/i)
  if (!match) return null
  return roundMacro(Number(match[1].replace(',', '.')))
}

export function mapOffProduct(raw: OffRawProduct): OffProduct | null {
  const code = raw.code?.trim()
  const name = (raw.product_name_es || raw.product_name || '').trim()
  if (!code || !name) return null
  const nutriments = raw.nutriments ?? {}
  const proteinPer100 = num(nutriments.proteins_100g)
  const carbsPer100 = num(nutriments.carbohydrates_100g)
  const fatPer100 = num(nutriments.fat_100g)
  const kcalPer100 =
    num(nutriments['energy-kcal_100g']) ??
    (num(nutriments.energy_100g) != null ? roundMacro((num(nutriments.energy_100g) as number) / 4.184) : null)
  const missing: OffProduct['missing'] = []
  if (proteinPer100 == null) missing.push('proteína')
  if (carbsPer100 == null) missing.push('hidratos')
  if (fatPer100 == null) missing.push('grasas')
  const servingGrams = parseServingGrams(raw)
  const portions: FoodPortion[] = servingGrams
    ? [{ label: 'Porción del paquete', grams: servingGrams, suggested: true }]
    : []
  return {
    code,
    name: name.slice(0, 120),
    brand: raw.brands?.split(',')[0]?.trim() || null,
    proteinPer100,
    carbsPer100,
    fatPer100,
    kcalPer100,
    portions,
    missing,
  }
}

export function offRowMeta(product: OffProduct): { detail: string; incomplete: boolean } {
  if (product.missing.includes('proteína') && product.missing.length >= 2) {
    return { detail: 'Le faltan datos', incomplete: true }
  }
  if (product.portions.length === 0) {
    const protein = product.proteinPer100
    if (protein == null) return { detail: 'Le faltan datos', incomplete: true }
    return {
      detail: `Solo en gramos · ${roundMacro(protein)} g cada 100 g`,
      incomplete: product.missing.length > 0,
    }
  }
  const portion = product.portions[0]
  const macros = scalePer100(
    {
      protein: product.proteinPer100,
      carbs: product.carbsPer100,
      fat: product.fatPer100,
      kcal: product.kcalPer100,
    },
    portion.grams,
  )
  if (macros.proteinG == null) {
    return {
      detail: `${portion.label.toLowerCase()} (${portion.grams} g) · Le faltan datos`,
      incomplete: true,
    }
  }
  return {
    detail: `1 ${portion.label.toLowerCase()} (${portion.grams} g) · ${macros.proteinG} g de proteína`,
    incomplete: product.missing.length > 0,
  }
}

export function macrosFromOff(product: OffProduct, grams: number): MacroInput {
  return scalePer100(
    {
      protein: product.proteinPer100,
      carbs: product.carbsPer100,
      fat: product.fatPer100,
      kcal: product.kcalPer100,
    },
    grams,
  )
}

export async function searchOpenFoodFacts(
  query: string,
  opts: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<OffSearchResult> {
  const trimmed = query.trim()
  if (!trimmed) return { ok: true, products: [] }
  const timeoutMs = opts.timeoutMs ?? 8000
  const params = new URLSearchParams({
    search_terms: trimmed,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '24',
    fields: [
      'code',
      'product_name',
      'product_name_es',
      'brands',
      'serving_size',
      'serving_quantity',
      'nutriments',
    ].join(','),
  })
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const onAbort = () => controller.abort()
  opts.signal?.addEventListener('abort', onAbort)
  try {
    const response = await fetch(`${OFF_SEARCH_URL}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'User-Agent': OFF_USER_AGENT,
        Accept: 'application/json',
      },
      signal: controller.signal,
    })
    if (!response.ok) return { ok: false, error: 'http' }
    const data = (await response.json()) as { products?: OffRawProduct[] }
    const products = (data.products ?? [])
      .map(mapOffProduct)
      .filter((product): product is OffProduct => product != null)
    return { ok: true, products }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { ok: false, error: opts.signal?.aborted ? 'network' : 'timeout' }
    }
    return { ok: false, error: 'network' }
  } finally {
    clearTimeout(timer)
    opts.signal?.removeEventListener('abort', onAbort)
  }
}
