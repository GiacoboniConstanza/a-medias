import { CargaScreen } from './CargaScreen.tsx'
import type { MovementPrefill } from '../components/MovementForm.tsx'

export type { MovementPrefill as ExpensePrefill }

/** Alta unificada de Finanzas en /cargar (7 tipos). */
export function ExpenseScreen({
  prefill,
  onCancel,
  onDone,
}: {
  prefill?: MovementPrefill
  onCancel?: () => void
  onDone?: () => void
} = {}) {
  return <CargaScreen prefillOverride={prefill} onCancel={onCancel} onDone={onDone} />
}
