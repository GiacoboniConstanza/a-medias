import { describe, expect, it } from 'vitest'
import { mapOffProduct, macrosFromOff, offRowMeta } from './openFoodFacts.ts'

describe('Open Food Facts mapping (R12–R14)', () => {
  it('arma porción del paquete y macros cada 100 g', () => {
    const product = mapOffProduct({
      code: '7790000000001',
      product_name: 'Milanesas de soja',
      brands: 'Marca Ejemplo, Otra',
      serving_quantity: 80,
      nutriments: {
        proteins_100g: 11.25,
        carbohydrates_100g: 20,
        fat_100g: 8,
        'energy-kcal_100g': 200,
      },
    })
    expect(product).toMatchObject({
      code: '7790000000001',
      name: 'Milanesas de soja',
      brand: 'Marca Ejemplo',
      portions: [{ label: 'Porción del paquete', grams: 80, suggested: true }],
      missing: [],
    })
    expect(macrosFromOff(product!, 80)).toEqual({
      proteinG: 9,
      carbsG: 16,
      fatG: 6,
      kcal: 154,
    })
    expect(offRowMeta(product!).detail).toContain('9 g de proteína')
  })

  it('marca faltantes y solo gramos', () => {
    const incomplete = mapOffProduct({
      code: '1',
      product_name: 'Sin datos',
      nutriments: { carbohydrates_100g: 40, 'energy-kcal_100g': 200 },
    })
    expect(incomplete?.missing).toEqual(['proteína', 'grasas'])
    expect(offRowMeta(incomplete!).detail).toBe('Le faltan datos')

    const gramsOnly = mapOffProduct({
      code: '2',
      product_name: 'Solo gramos',
      nutriments: { proteins_100g: 6, carbohydrates_100g: 10, fat_100g: 1 },
    })
    expect(offRowMeta(gramsOnly!).detail).toBe('Solo en gramos · 6 g cada 100 g')
  })
})
