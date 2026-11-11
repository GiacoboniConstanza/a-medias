import { describe, expect, it } from 'vitest'
import { activeSavings, archivedSavings, groupSavings, legacySavingsLocation, savingPercent } from './savings.ts'
import type { SavingItem } from './api.ts'

const base = (patch: Partial<SavingItem> & Pick<SavingItem, 'id' | 'name' | 'isShared'>): SavingItem => ({
  householdId: 'h',
  icon: 'piggy-bank',
  target: null,
  targetDate: null,
  ownerId: patch.isShared ? null : 'me',
  archivedAt: null,
  openings: [],
  ...patch,
})

describe('agrupar ahorros', () => {
  it('pone compartidos primero y separa los tuyos', () => {
    const items = [
      base({ id: 'bici', name: 'Bici', isShared: false }),
      base({ id: 'vacas', name: 'Vacaciones', isShared: true }),
      base({ id: 'colchon', name: 'Colchón', isShared: false }),
    ]
    const { shared, own } = groupSavings(items)
    expect(shared.map((row) => row.id)).toEqual(['vacas'])
    expect(own.map((row) => row.id)).toEqual(['bici', 'colchon'])
  })
})

describe('rutas viejas', () => {
  it('manda Bolsa y Meta a /ahorros', () => {
    expect(legacySavingsLocation('/bolsa')).toBe('/ahorros')
    expect(legacySavingsLocation('/meta')).toBe('/ahorros')
    expect(legacySavingsLocation('/ahorros')).toBeNull()
  })
})

describe('activos y archivados', () => {
  it('separa por archivedAt', () => {
    const rows = [
      base({ id: 'a', name: 'A', isShared: true, archivedAt: null }),
      base({ id: 'b', name: 'B', isShared: false, archivedAt: '2026-10-01T00:00:00Z' }),
    ]
    expect(activeSavings(rows).map((row) => row.id)).toEqual(['a'])
    expect(archivedSavings(rows).map((row) => row.id)).toEqual(['b'])
  })
})

describe('porcentaje', () => {
  it('respeta meta nula', () => {
    expect(savingPercent(100, null)).toBe(0)
    expect(savingPercent(50, 200)).toBe(25)
  })
})
