import {
  firstMonthFromCurrent,
  installmentAmountFromTotal,
  type InstallmentPlan,
} from './fixed.ts'
import { normalizeMoney } from './format.ts'

export type FixedKind = 'fixed' | 'installments'

export type FixedFormDraft = {
  kind: FixedKind
  title: string
  icon: string
  amount: number
  dueDay: number
  shared: boolean
  remind: boolean
  notes: string | null
  categoryId: string | null
  count: number | null
  currentNumber: number | null
  total: number | null
  amountChanged: boolean
  applies: 'this' | 'next' | null
}

export function formTitle(kind: FixedKind, editing: boolean): string {
  if (kind === 'installments') return editing ? 'Editar cuotas' : 'Nuevas cuotas'
  return editing ? 'Editar gasto fijo' : 'Nuevo gasto fijo'
}

export function resolveInstallmentAmount(input: {
  amount: number
  total: number | null
  count: number | null
}): number {
  if (input.total != null && input.total > 0 && input.count != null && input.count >= 2) {
    return installmentAmountFromTotal(input.total, input.count)
  }
  return normalizeMoney(input.amount)
}

export function resolveInstallmentTotal(input: {
  amount: number
  total: number | null
  count: number | null
}): number | null {
  if (input.total != null && input.total > 0) return normalizeMoney(input.total)
  if (input.count != null && input.count >= 2 && input.amount > 0) {
    return normalizeMoney(input.amount * input.count)
  }
  return null
}

export function validateFixedForm(draft: FixedFormDraft): string {
  if (!draft.title.trim()) return 'Completá el nombre.'
  if (draft.kind === 'fixed') {
    if (draft.amount <= 0) return 'Completá el monto.'
    if (draft.dueDay < 1 || draft.dueDay > 28) return 'El día tiene que ser del 1 al 28.'
    if (draft.amountChanged && !draft.applies) return 'Elegí desde cuándo aplica el monto.'
    return ''
  }
  const count = draft.count ?? 0
  const current = draft.currentNumber ?? 0
  if (count < 2) return 'La cantidad tiene que ser 2 o más.'
  if (current < 1 || current > count) return '«Va por la cuota» tiene que estar entre 1 y la cantidad.'
  const amount = resolveInstallmentAmount({
    amount: draft.amount,
    total: draft.total,
    count,
  })
  if (amount <= 0) return 'Completá el monto o el total.'
  return ''
}

export function installmentPlanFromDraft(
  draft: FixedFormDraft,
  visibleMonth: string,
): InstallmentPlan | null {
  if (draft.kind !== 'installments') return null
  const count = draft.count ?? 0
  const current = draft.currentNumber ?? 1
  if (count < 2) return null
  return {
    firstMonth: firstMonthFromCurrent(visibleMonth, current),
    count,
  }
}

export function defaultDueDayForInstallments(): number {
  return 10
}
