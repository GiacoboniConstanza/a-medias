export type CategoryChip = { id: string; name: string; icon: string }

export type CategoryUsage = { categoryId: string; uses: number; hasLinks: boolean }

/** Las 6 más usadas (y si no hay uso, las primeras alfabéticas). */
export function suggestedCategories<T extends CategoryChip>(
  categories: readonly T[],
  usage: readonly CategoryUsage[],
  limit = 6,
): T[] {
  const ordered = [...categories].sort((left, right) => left.name.localeCompare(right.name, 'es'))
  if (ordered.length === 0) return []
  const byId = new Map(usage.map((row) => [row.categoryId, row.uses]))
  const ranked = [...ordered].sort((left, right) => {
    const leftUses = byId.get(left.id) ?? 0
    const rightUses = byId.get(right.id) ?? 0
    if (leftUses !== rightUses) return rightUses - leftUses
    return left.name.localeCompare(right.name, 'es')
  })
  const anyUse = ranked.some((row) => (byId.get(row.id) ?? 0) > 0)
  return (anyUse ? ranked : ordered).slice(0, limit)
}

/** Chips de Cargar / fijo: sugeridas (+ elegida si falta) o todas. */
export function categoryChipsForPicker<T extends CategoryChip>(
  categories: readonly T[],
  usage: readonly CategoryUsage[],
  selectedId: string | null,
  showAll: boolean,
): T[] {
  if (showAll) {
    return [...categories].sort((left, right) => left.name.localeCompare(right.name, 'es'))
  }
  const base = suggestedCategories(categories, usage)
  const selected = selectedId ? categories.find((category) => category.id === selectedId) : undefined
  if (selected && !base.some((category) => category.id === selected.id)) return [...base, selected]
  return base
}

/** Categoría al pagar un fijo: la del fijo, o ninguna (nunca la primera al azar). */
export function categoryIdForFixedPayment(categoryId: string | null | undefined): string | null {
  return categoryId ?? null
}
