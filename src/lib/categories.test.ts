import { describe, expect, it } from 'vitest'
import {
  categoryChipsForPicker,
  categoryIdForFixedPayment,
  suggestedCategories,
  type CategoryUsage,
} from './categories.ts'

const cats = [
  { id: '1', name: 'Comida', icon: 'pizza-slice' },
  { id: '2', name: 'Hogar', icon: 'house' },
  { id: '3', name: 'Salidas', icon: 'champagne-glasses' },
  { id: '4', name: 'Servicios', icon: 'lightbulb' },
  { id: '5', name: 'Súper', icon: 'cart-shopping' },
  { id: '6', name: 'Viajes', icon: 'bus' },
  { id: '7', name: 'Zeta', icon: 'star' },
]

describe('sugeridas por uso (E13)', () => {
  it('sin uso: primeras alfabéticas', () => {
    expect(suggestedCategories(cats, []).map((row) => row.name)).toEqual([
      'Comida',
      'Hogar',
      'Salidas',
      'Servicios',
      'Súper',
      'Viajes',
    ])
  })

  it('con uso: las 6 más usadas', () => {
    const usage: CategoryUsage[] = [
      { categoryId: '7', uses: 10, hasLinks: true },
      { categoryId: '4', uses: 8, hasLinks: true },
      { categoryId: '1', uses: 3, hasLinks: true },
    ]
    expect(suggestedCategories(cats, usage).map((row) => row.name)).toEqual([
      'Zeta',
      'Servicios',
      'Comida',
      'Hogar',
      'Salidas',
      'Súper',
    ])
  })

  it('incluye la elegida aunque no esté en las 6', () => {
    const usage: CategoryUsage[] = [{ categoryId: '1', uses: 99, hasLinks: true }]
    const chips = categoryChipsForPicker(cats, usage, '7', false)
    expect(chips.some((row) => row.id === '7')).toBe(true)
    expect(chips[0]?.id).toBe('1')
  })
})

describe('pago de fijo con categoría (E14)', () => {
  it('usa la del fijo o ninguna', () => {
    expect(categoryIdForFixedPayment('abc')).toBe('abc')
    expect(categoryIdForFixedPayment(null)).toBeNull()
    expect(categoryIdForFixedPayment(undefined)).toBeNull()
  })
})
