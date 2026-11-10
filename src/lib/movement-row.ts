import { clampNotes } from './format.ts'

/** Título y bajada de una fila de Movimientos (nombre > categoría > tipo). */

/** En edición el tipo queda fijo: hay que borrar y cargar de nuevo para cambiarlo. */
export function movementTypeIsLocked(editing: boolean): boolean {
  return editing
}

/** "Quién pagó" solo aplica a gastos compartidos con compañera en el hogar. */
export function showSharedPayerPicker(input: {
  tipo: 'gasto' | 'ingreso' | 'transferencia' | null
  shared: boolean
  hasPartner: boolean
}): boolean {
  return input.tipo === 'gasto' && input.shared && input.hasPartner
}

/** Nombre y observación del formulario: van a columnas distintas. */
export function movementTextFields(name: string, observation: string): {
  title: string | null
  notes: string | null
} {
  return {
    title: clampNotes(name),
    notes: clampNotes(observation),
  }
}

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
