import { describe, expect, it, vi } from 'vitest'
import { finishHouseholdSetup } from './create-home.ts'

describe('crear hogar y vincular el perfil', () => {
  it('devuelve el hogar cuando el perfil queda vinculado', async () => {
    const householdId = await finishHouseholdSetup({
      call: async () => ({ error: null }),
      refreshProfile: async () => ({ householdId: 'hogar-1' }),
      failure: 'El hogar no quedó vinculado a tu perfil.',
    })

    expect(householdId).toBe('hogar-1')
  })

  it('muestra el error de la llamada en lugar de ignorarlo', async () => {
    const refreshProfile = vi.fn(async () => ({ householdId: 'hogar-1' }))

    await expect(
      finishHouseholdSetup({
        call: async () => ({ error: { message: 'No se pudo vincular el hogar al perfil' } }),
        refreshProfile,
        failure: 'El hogar no quedó vinculado a tu perfil.',
      }),
    ).rejects.toThrow('No se pudo vincular el hogar al perfil')

    expect(refreshProfile).not.toHaveBeenCalled()
  })

  it('avisa si después de crear el perfil sigue sin hogar', async () => {
    await expect(
      finishHouseholdSetup({
        call: async () => ({ error: null }),
        refreshProfile: async () => ({ householdId: null }),
        failure: 'El hogar no quedó vinculado a tu perfil.',
      }),
    ).rejects.toThrow('El hogar no quedó vinculado a tu perfil.')
  })

  it('propaga el error al refrescar el perfil', async () => {
    await expect(
      finishHouseholdSetup({
        call: async () => ({ error: null }),
        refreshProfile: async () => {
          throw new Error('permission denied for table profiles')
        },
        failure: 'El hogar no quedó vinculado a tu perfil.',
      }),
    ).rejects.toThrow('permission denied for table profiles')
  })
})
