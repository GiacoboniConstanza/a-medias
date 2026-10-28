import { describe, expect, it } from 'vitest'
import { checkedThisWeek, groupMemos, memoCounts, partnerPendingMemos, plantLine, type MemoItem } from './memos.ts'
import { enabledFromRows, moduleSwitchLocked, navForModules, toggleAllowed } from './modules.ts'

const memo = (patch: Partial<MemoItem> & Pick<MemoItem, 'id' | 'ownerId'>): MemoItem => ({
  text: 'Anotar',
  done: false,
  shared: false,
  updatedAt: '2026-10-27T15:00:00.000Z',
  ...patch,
})

describe('filtro del menú', () => {
  it('con solo Finanzas mantiene el menú de hoy', () => {
    expect(navForModules(['finanzas']).map((item) => item.label)).toEqual(['Inicio', 'Gastos', 'Bolsa', 'Meta', 'Avisos'])
    expect(navForModules(enabledFromRows([])).map((item) => item.label)).toEqual([
      'Inicio',
      'Gastos',
      'Bolsa',
      'Meta',
      'Avisos',
    ])
  })

  it('muestra Inicio y solo los módulos activos, en orden fijo', () => {
    expect(navForModules(['memos', 'finanzas']).map((item) => item.label)).toEqual(['Inicio', 'Finanzas', 'Memos'])
    expect(navForModules(['memos']).map((item) => ({ label: item.label, to: item.to }))).toEqual([
      { label: 'Inicio', to: '/' },
      { label: 'Memos', to: '/memos' },
    ])
  })

  it('con Finanzas y Memos el menú queda en Inicio, Finanzas y Memos', () => {
    expect(navForModules(['finanzas', 'memos']).map((item) => item.to)).toEqual(['/', '/finanzas', '/memos'])
  })
})

describe('al menos un módulo activo', () => {
  it('no deja apagar el único', () => {
    expect(moduleSwitchLocked(['finanzas'], 'finanzas')).toBe(true)
    expect(toggleAllowed(['finanzas'], 'finanzas', false)).toBe('Tiene que quedar al menos un módulo activo')
    expect(toggleAllowed(['memos'], 'memos', false)).toBe('Tiene que quedar al menos un módulo activo')
  })

  it('deja apagar uno si queda otro prendido', () => {
    expect(moduleSwitchLocked(['finanzas', 'memos'], 'finanzas')).toBe(false)
    expect(toggleAllowed(['finanzas', 'memos'], 'finanzas', false)).toBeNull()
    expect(toggleAllowed(['finanzas', 'memos'], 'memos', false)).toBeNull()
  })

  it('no prende Hábitos ni Comidas', () => {
    expect(toggleAllowed(['finanzas'], 'habitos', true)).toBe('Próximamente')
    expect(toggleAllowed(['finanzas'], 'comidas', true)).toBe('Próximamente')
  })

  it('sin filas, Finanzas sigue siendo el módulo de hoy', () => {
    expect(enabledFromRows([])).toEqual(['finanzas'])
    expect(enabledFromRows([{ module: 'finanzas', enabled: true }, { module: 'memos', enabled: false }])).toEqual([
      'finanzas',
    ])
    expect(enabledFromRows([{ module: 'finanzas', enabled: false }, { module: 'memos', enabled: true }])).toEqual([
      'memos',
    ])
  })
})

describe('memos del hub', () => {
  const items = [
    memo({ id: '1', ownerId: 'coty', shared: true, text: 'Gatos' }),
    memo({ id: '2', ownerId: 'coty', text: 'Turno' }),
    memo({ id: '3', ownerId: 'maru', shared: true, done: true, text: 'Hecho' }),
    memo({ id: '4', ownerId: 'maru', text: 'Privado de Maru' }),
  ]

  it('en el inicio de la otra solo entran los compartidos pendientes', () => {
    expect(partnerPendingMemos(items, 'maru').map((item) => item.id)).toEqual(['1'])
  })

  it('arma los grupos Con la otra y Solo vos', () => {
    const groups = groupMemos(items, 'coty')
    expect(groups.shared.map((item) => item.id)).toEqual(['1', '3'])
    expect(groups.solo.map((item) => item.id)).toEqual(['2'])
  })

  it('cuenta pendientes y los tachados de esta semana', () => {
    expect(memoCounts(items)).toEqual({ pending: 3, sharedPending: 1 })
    const now = new Date(2026, 9, 28)
    expect(
      checkedThisWeek(
        [
          memo({ id: 'a', ownerId: 'coty', done: true, updatedAt: '2026-10-27T15:00:00.000Z' }),
          memo({ id: 'b', ownerId: 'coty', done: true, updatedAt: '2026-10-20T15:00:00.000Z' }),
          memo({ id: 'c', ownerId: 'maru', done: true, updatedAt: '2026-10-27T15:00:00.000Z' }),
        ],
        'coty',
        now,
      ),
    ).toBe(1)
    expect(plantLine(2, 0).detail).toBe('Tenés 2 memos pendientes.')
  })
})
