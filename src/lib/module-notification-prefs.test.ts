import { describe, expect, it } from 'vitest'
import { modulePrefEnabled } from './api.ts'

describe('modulePrefEnabled', () => {
  it('Finanzas sin fila queda apagado (opt-in)', () => {
    expect(modulePrefEnabled([], 'finanzas', false)).toBe(false)
    expect(modulePrefEnabled([{ module: 'medicamentos', enabled: true }], 'finanzas', false)).toBe(false)
  })

  it('Finanzas respeta la fila enabled', () => {
    expect(modulePrefEnabled([{ module: 'finanzas', enabled: true }], 'finanzas', false)).toBe(true)
    expect(modulePrefEnabled([{ module: 'finanzas', enabled: false }], 'finanzas', false)).toBe(false)
  })

  it('Medicamentos sin fila sigue prendido por defecto', () => {
    expect(modulePrefEnabled([], 'medicamentos', true)).toBe(true)
  })
})
