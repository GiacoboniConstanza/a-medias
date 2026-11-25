import { describe, expect, it } from 'vitest'
import {
  formTitle,
  installmentPlanFromDraft,
  resolveInstallmentAmount,
  validateFixedForm,
  type FixedFormDraft,
} from './fixed-form.ts'

const baseFixed: FixedFormDraft = {
  kind: 'fixed',
  title: 'Luz',
  icon: 'bolt',
  amount: 10_000,
  dueDay: 15,
  shared: true,
  remind: true,
  notes: null,
  categoryId: null,
  count: null,
  currentNumber: null,
  total: null,
  amountChanged: false,
  applies: null,
}

const baseCuotas: FixedFormDraft = {
  kind: 'installments',
  title: 'Cama',
  icon: 'couch',
  amount: 212_265.83,
  dueDay: 10,
  shared: false,
  remind: true,
  notes: null,
  categoryId: null,
  count: 18,
  currentNumber: 1,
  total: 3_820_784.98,
  amountChanged: false,
  applies: null,
}

describe('formulario fijo / cuotas', () => {
  it('título según tipo', () => {
    expect(formTitle('fixed', false)).toBe('Nuevo gasto fijo')
    expect(formTitle('fixed', true)).toBe('Editar gasto fijo')
    expect(formTitle('installments', false)).toBe('Nuevas cuotas')
    expect(formTitle('installments', true)).toBe('Editar cuotas')
  })

  it('guarda gasto fijo con nombre, monto y día', () => {
    expect(validateFixedForm(baseFixed)).toBe('')
    expect(validateFixedForm({ ...baseFixed, title: '' })).toBe('Completá el nombre.')
    expect(validateFixedForm({ ...baseFixed, amount: 0 })).toBe('Completá el monto.')
  })

  it('guarda cuotas con cantidad, cuota/total y va por la n', () => {
    expect(validateFixedForm(baseCuotas)).toBe('')
    expect(resolveInstallmentAmount({ amount: 0, total: 3_820_784.98, count: 18 })).toBe(212_265.83)
    expect(installmentPlanFromDraft({ ...baseCuotas, currentNumber: 5 }, '2026-11-01')).toEqual({
      firstMonth: '2026-07-01',
      count: 18,
    })
    expect(validateFixedForm({ ...baseCuotas, count: 1 })).toBe('La cantidad tiene que ser 2 o más.')
  })
})
