import { describe, expect, it } from 'vitest'
import { potStage } from './Plant.tsx'

describe('etapa de la planta según el progreso', () => {
  it('en 0% es una semilla', () => {
    expect(potStage(0)).toBe('seed')
    expect(potStage(-10)).toBe('seed')
  })

  it('un avance chico es un brote', () => {
    expect(potStage(4)).toBe('sprout')
    expect(potStage(24.9)).toBe('sprout')
  })

  it('a mitad de camino es una planta mediana', () => {
    expect(potStage(25)).toBe('medium')
    expect(potStage(36)).toBe('medium')
    expect(potStage(74.9)).toBe('medium')
  })

  it('desde el 75% y al 100% es la planta grande', () => {
    expect(potStage(75)).toBe('grown')
    expect(potStage(87)).toBe('grown')
    expect(potStage(100)).toBe('grown')
    expect(potStage(140)).toBe('grown')
  })

  it('un progreso inválido queda en semilla', () => {
    expect(potStage(Number.NaN)).toBe('seed')
  })
})
