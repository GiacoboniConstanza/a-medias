import { describe, expect, it } from 'vitest'
import { PUSH_STATUS, duesPushTitle, pushPlan } from './plan.ts'

describe('push plan Finanzas', () => {
  it('marca el contrato como activo', () => {
    expect(PUSH_STATUS).toBe('active')
    expect(pushPlan.status).toBe('active')
  })

  it('arma los textos de diario, vencimientos y silencio', () => {
    expect(pushPlan.daily.title).toBe('¿Gastaste algo hoy?')
    expect(pushPlan.silence.title).toBe('¿Seguimos anotando?')
    expect(duesPushTitle(['Luz'])).toBe('Vence Luz')
    expect(duesPushTitle(['Gas', 'Luz'])).toBe('Vencen Gas y Luz')
    expect(duesPushTitle(['Agua', 'Gas', 'Luz'])).toBe('Vence Agua y 2 más')
  })
})
