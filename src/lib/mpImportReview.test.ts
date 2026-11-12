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

describe('categoryChipsForEdit', () => {
  it('con Ver todas muestra todas', () => {
    expect(categoryChipsForEdit(cats, '', true)).toHaveLength(8)
  })

  it('sin Ver todas muestra sugeridas y agrega la elegida si falta', () => {
    const list = categoryChipsForEdit(cats, '8', false)
    expect(list.map((row) => row.name)).toEqual([
      'Súper',
      'Comida',
      'Hogar',
      'Luz',
      'Salidas',
      'Farmacia',
      'Viajes',
    ])
    expect(list.some((row) => row.id === '8')).toBe(true)
  })

  it('no duplica la elegida si ya está en sugeridas', () => {
    const list = categoryChipsForEdit(cats, '1', false)
    expect(list.filter((row) => row.id === '1')).toHaveLength(1)
    expect(list).toHaveLength(6)
  })
})
