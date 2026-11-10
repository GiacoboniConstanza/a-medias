import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCategory } from './api.ts'

const state = vi.hoisted(() => ({
  error: null as { code?: string; message: string } | null,
  inserted: null as Record<string, unknown> | null,
}))

vi.mock('./supabase.ts', () => ({
  supabase: {
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        state.inserted = row
        return {
          select: () => ({
            single: async () => {
              if (state.error) return { data: null, error: state.error }
              return { data: { id: 'nueva-categoria' }, error: null }
            },
          }),
        }
      },
    }),
  },
  supabaseConfigError: null,
}))

describe('createCategory', () => {
  beforeEach(() => {
    state.error = null
    state.inserted = null
  })

  it('crea una categoría del hogar sin dueño', async () => {
    const id = await createCategory({ householdId: 'hogar', name: '  Café  ', icon: 'mug-hot' })
    expect(id).toBe('nueva-categoria')
    expect(state.inserted).toEqual({
      household_id: 'hogar',
      name: 'Café',
      icon: 'mug-hot',
      emoji: 'mug-hot',
    })
  })

  it('si el nombre ya existe muestra un error amable', async () => {
    state.error = { code: '23505', message: 'duplicate key value violates unique constraint' }
    await expect(
      createCategory({ householdId: 'hogar', name: 'Comida', icon: 'pizza-slice' }),
    ).rejects.toThrow('Esa categoría ya está en el hogar.')
  })

  it('otros errores de la base se muestran tal cual', async () => {
    state.error = { message: 'sin permiso' }
    await expect(
      createCategory({ householdId: 'hogar', name: 'Salidas', icon: 'champagne-glasses' }),
    ).rejects.toThrow('sin permiso')
  })
})
