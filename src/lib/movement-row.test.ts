import { describe, expect, it } from 'vitest'
import { movementExpenseSubtitle, movementExpenseTitle, movementTextFields } from './movement-row.ts'

describe('nombre y observación del formulario', () => {
  it('guarda el nombre en title y la observación en notes, sin copiarse', () => {
    expect(movementTextFields('Alquiler', 'Pago del mes')).toEqual({
      title: 'Alquiler',
      notes: 'Pago del mes',
    })
    expect(movementTextFields('  Farmacia  ', '')).toEqual({
      title: 'Farmacia',
      notes: null,
    })
    expect(movementTextFields('', 'Solo una nota')).toEqual({
      title: null,
      notes: 'Solo una nota',
    })
    expect(movementTextFields('   ', '   ')).toEqual({
      title: null,
      notes: null,
    })
  })
})

describe('título de la fila de Movimientos', () => {
  it('usa el nombre, si no la categoría, si no el tipo', () => {
    expect(movementExpenseTitle({ title: 'Alquiler', categoryName: 'Hogar' })).toBe('Alquiler')
    expect(movementExpenseTitle({ title: '  ', categoryName: 'Súper' })).toBe('Súper')
    expect(movementExpenseTitle({ title: null, categoryName: null })).toBe('Gasto')
    expect(movementExpenseTitle({ title: null, categoryName: null, fallback: 'Ingreso' })).toBe('Ingreso')
  })

  it('no usa la observación: el nombre es el title cargado', () => {
    expect(movementExpenseTitle({ title: 'Farmacia del pueblo', categoryName: 'Farmacia' })).toBe('Farmacia del pueblo')
  })
})

describe('bajada de la fila de Movimientos', () => {
  it('en compartidos mantiene quién pagó, Compartido y categoría si hay nombre', () => {
    expect(
      movementExpenseSubtitle({
        isShared: true,
        paidByMe: true,
        partnerName: 'Maru',
        title: 'Súper',
        categoryName: 'Súper',
      }),
    ).toBe('Pagaste vos · Compartido · Súper')

    expect(
      movementExpenseSubtitle({
        isShared: true,
        paidByMe: false,
        partnerName: 'Maru',
        payerName: 'Maru',
        title: null,
        categoryName: 'Luz',
      }),
    ).toBe('Pagó Maru · Compartido')
  })

  it('en privados no dice Pagaste vos y omite la bajada si no queda nada', () => {
    expect(
      movementExpenseSubtitle({
        isShared: false,
        paidByMe: true,
        partnerName: 'Maru',
        title: 'Alquiler',
        categoryName: 'Hogar',
      }),
    ).toBe('Hogar')

    expect(
      movementExpenseSubtitle({
        isShared: false,
        paidByMe: true,
        partnerName: 'Maru',
        title: null,
        categoryName: 'Farmacia',
      }),
    ).toBe('')

    expect(
      movementExpenseSubtitle({
        isShared: false,
        paidByMe: true,
        partnerName: 'Maru',
        title: null,
        categoryName: null,
      }),
    ).toBe('')
  })
})
