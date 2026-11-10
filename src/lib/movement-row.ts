/** Título y bajada de una fila de Movimientos (nombre > categoría > tipo). */

export function movementExpenseTitle(input: {
  title?: string | null
  categoryName?: string | null
  fallback?: string
}): string {
  const name = input.title?.trim()
  if (name) return name
  const category = input.categoryName?.trim()
  if (category) return category
  return input.fallback ?? 'Gasto'
}

export function movementExpenseSubtitle(input: {
  isShared: boolean
  paidByMe: boolean
  partnerName: string
  payerName?: string | null
  categoryName?: string | null
  title?: string | null
}): string {
  const name = input.title?.trim() || null
  const category = input.categoryName?.trim() || null
  const parts: string[] = []

  if (input.isShared) {
    parts.push(input.paidByMe ? 'Pagaste vos' : `Pagó ${input.payerName?.trim() || input.partnerName}`)
    parts.push('Compartido')
    if (category && name) parts.push(category)
  } else if (category && name) {
    // Privado: sin "Pagaste vos"; solo categoría u otros datos si quedan.
    parts.push(category)
  }

  return parts.join(' · ')
}
