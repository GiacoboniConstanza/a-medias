import { describe, expect, it } from 'vitest'
import {
  filterSavings,
  goalSaved,
  legacySavingsLocation,
  activeSavings,
  activeSharedGoal,
  archivedSavings,
  rememberedSavingsScope,
  savingSources,
  savingTotals,
  type SavingGoalInput,
  type SavingInput,
} from './savings.ts'

const funds: SavingInput[] = [
  { id: 'sillon', name: 'Sillón', icon: 'couch', target: 100_000, targetDate: null, saved: 40_000 },
  { id: 'notebook', name: 'Notebook', icon: 'laptop', target: 80_000, targetDate: null, saved: 10_000 },
]

const goal: SavingGoalInput = {
  id: 'vacaciones',
  name: 'Vacaciones',
  icon: 'umbrella-beach',
  target: 1_000_000,
  targetDate: '2027-03-01',
  byUser: [
    { amount: 200_000 },
    { amount: 50_000 },
  ],
}

describe('filtro de ahorros', () => {
  const rows = savingSources(funds, goal)

  it('separa compartidos y privados', () => {
    expect(filterSavings(rows, 'all').map((row) => row.id)).toEqual(['vacaciones', 'sillon', 'notebook'])
    expect(filterSavings(rows, 'shared').map((row) => row.id)).toEqual(['vacaciones'])
    expect(filterSavings(rows, 'private').map((row) => row.id)).toEqual(['sillon', 'notebook'])
  })

  it('sin meta solo quedan los privados', () => {
    expect(savingSources(funds, null).map((row) => row.shared)).toEqual([false, false])
  })

  it('la ruta vieja manda sobre el filtro guardado', () => {
    expect(rememberedSavingsScope('shared', null)).toBe('shared')
    expect(rememberedSavingsScope('shared', 'private')).toBe('private')
    expect(rememberedSavingsScope('cualquier-cosa', null)).toBe('all')
  })
})

describe('rutas viejas de ahorros', () => {
  it('manda Bolsa a privados y Meta a compartidos', () => {
    expect(legacySavingsLocation('/bolsa')).toBe('/ahorros?alcance=private')
    expect(legacySavingsLocation('/meta')).toBe('/ahorros?alcance=shared')
    expect(legacySavingsLocation('/ahorros')).toBeNull()
  })
})

describe('ahorro compartido activo', () => {
  it('elige el que no está archivado aunque sea más viejo', () => {
    const chosen = activeSharedGoal([
      { id: 'nuevo', archivedAt: '2026-11-01T00:00:00Z', createdAt: '2026-08-01T00:00:00Z' },
      { id: 'viejo', archivedAt: null, createdAt: '2026-01-01T00:00:00Z' },
    ])
    expect(chosen?.id).toBe('viejo')
  })

  it('deja los archivados fuera de la lista activa y el filtro los sigue separando', () => {
    const rows = [
      { id: 'viaje', shared: true, archivedAt: null },
      { id: 'viaje-viejo', shared: true, archivedAt: '2026-10-01T00:00:00Z' },
      { id: 'sillon', shared: false, archivedAt: null },
      { id: 'curso', shared: false, archivedAt: '2026-09-01T00:00:00Z' },
    ]
    expect(activeSavings(rows).map((row) => row.id)).toEqual(['viaje', 'sillon'])
    expect(filterSavings(archivedSavings(rows), 'shared').map((row) => row.id)).toEqual(['viaje-viejo'])
    expect(filterSavings(archivedSavings(rows), 'private').map((row) => row.id)).toEqual(['curso'])
  })
})

describe('totales de ahorros', () => {
  it('coinciden con la suma de los fondos y de los aportes de la meta', () => {
    const rows = savingSources(funds, goal)
    const privateBefore = funds.reduce((sum, fund) => sum + fund.saved, 0)
    const sharedBefore = goalSaved(goal.byUser)
    expect(savingTotals(rows)).toEqual({
      all: privateBefore + sharedBefore,
      shared: sharedBefore,
      private: privateBefore,
    })
    expect(savingTotals(filterSavings(rows, 'private')).private).toBe(privateBefore)
    expect(savingTotals(filterSavings(rows, 'shared')).shared).toBe(sharedBefore)
    expect(sharedBefore).toBe(250_000)
    expect(privateBefore).toBe(50_000)
  })
})
