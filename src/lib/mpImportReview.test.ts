import { describe, expect, it } from 'vitest'
import { categoryChipsForEdit } from './mpImportReview.ts'

const cats = [
  { id: '1', name: 'Súper', icon: 'cart-shopping' },
  { id: '2', name: 'Comida', icon: 'pizza-slice' },
  { id: '3', name: 'Hogar', icon: 'house' },
  { id: '4', name: 'Luz', icon: 'lightbulb' },
  { id: '5', name: 'Salidas', icon: 'champagne-glasses' },
  { id: '6', name: 'Farmacia', icon: 'pills' },
  { id: '7', name: 'Mascotas', icon: 'paw' },
  { id: '8', name: 'Viajes', icon: 'plane' },
]

describe('categoryChipsForEdit (E13)', () => {
  it('con Ver todas muestra todas ordenadas', () => {
    expect(categoryChipsForEdit(cats, '', true).map((row) => row.name)).toEqual([
      'Comida',
      'Farmacia',
      'Hogar',
      'Luz',
      'Mascotas',
      'Salidas',
      'Súper',
      'Viajes',
    ])
  })

  it('sin uso: primeras alfabéticas y agrega la elegida si falta', () => {
    const list = categoryChipsForEdit(cats, '8', false)
    expect(list.map((row) => row.name)).toEqual([
      'Comida',
      'Farmacia',
      'Hogar',
      'Luz',
      'Mascotas',
      'Salidas',
      'Viajes',
    ])
    expect(list.some((row) => row.id === '8')).toBe(true)
  })

  it('con uso: las más usadas primero', () => {
    const list = categoryChipsForEdit(cats, '1', false, [
      { categoryId: '8', uses: 9, hasLinks: true },
      { categoryId: '7', uses: 5, hasLinks: true },
    ])
    expect(list.map((row) => row.name).slice(0, 2)).toEqual(['Viajes', 'Mascotas'])
    expect(list.filter((row) => row.id === '1')).toHaveLength(1)
  })
})
