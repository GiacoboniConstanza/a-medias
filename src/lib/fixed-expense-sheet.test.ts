import { describe, expect, it } from 'vitest'
import { sheetFormSubmitProps } from './fixed.ts'

describe('FixedExpenseSheet Guardar', () => {
  it('el Guardar del footer envía el formulario (type=submit + form id)', () => {
    expect(sheetFormSubmitProps('fixed-expense-form')).toEqual({
      type: 'submit',
      form: 'fixed-expense-form',
    })
  })
})
