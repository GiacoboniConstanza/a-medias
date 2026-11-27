import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  afterSavePath,
  cargaPath,
  parseCargaTipo,
  readLastCargaTipo,
  rememberCargaTipo,
  shouldSkipStep1,
  step2Title,
} from './carga.ts'

const memory = new Map<string, string>()

describe('carga', () => {
  beforeEach(() => {
    memory.clear()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value)
      },
      removeItem: (key: string) => {
        memory.delete(key)
      },
      clear: () => memory.clear(),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('parseCargaTipo acepta los 7 tipos y rechaza basura', () => {
    expect(parseCargaTipo('gasto')).toBe('gasto')
    expect(parseCargaTipo('fijo')).toBe('fijo')
    expect(parseCargaTipo('cuotas')).toBe('cuotas')
    expect(parseCargaTipo('plan')).toBe('plan')
    expect(parseCargaTipo('nope')).toBeNull()
    expect(parseCargaTipo(null)).toBeNull()
  })

  it('rememberCargaTipo y readLastCargaTipo persisten el Último', () => {
    expect(readLastCargaTipo()).toBeNull()
    rememberCargaTipo('ingreso')
    expect(readLastCargaTipo()).toBe('ingreso')
    rememberCargaTipo('plan')
    expect(readLastCargaTipo()).toBe('plan')
  })

  it('step2Title usa los textos exactos', () => {
    expect(step2Title('gasto')).toBe('Nuevo gasto')
    expect(step2Title('ingreso')).toBe('Nuevo ingreso')
    expect(step2Title('transferencia')).toBe('Nueva transferencia')
    expect(step2Title('ahorro')).toBe('Nuevo ahorro')
    expect(step2Title('fijo')).toBe('Nuevo gasto fijo')
    expect(step2Title('cuotas')).toBe('Nuevas cuotas')
    expect(step2Title('plan')).toBe('Nuevo plan')
  })

  it('afterSavePath manda fijos/cuotas a Gastos fijos y plan a Planes', () => {
    expect(afterSavePath('fijo')).toBe('/recordatorios')
    expect(afterSavePath('cuotas')).toBe('/recordatorios')
    expect(afterSavePath('plan')).toBe('/planes')
    expect(afterSavePath('gasto')).toBe('')
  })

  it('shouldSkipStep1 según origen', () => {
    expect(shouldSkipStep1({ planItemId: 'p1' })).toBe(true)
    expect(shouldSkipStep1({ savingId: 's1', tipo: 'ahorro' })).toBe(true)
    expect(shouldSkipStep1({ tipo: 'plan', from: '/planes' })).toBe(true)
    expect(shouldSkipStep1({ tipo: 'gasto', from: '/recordatorios' })).toBe(true)
    expect(shouldSkipStep1({ tipo: 'gasto', from: '/compartir' })).toBe(true)
    expect(shouldSkipStep1({ tipo: 'gasto', from: '/movimientos' })).toBe(false)
    expect(shouldSkipStep1({ tipo: 'ingreso', from: '/finanzas' })).toBe(false)
    expect(shouldSkipStep1({ skipStep1: true, tipo: 'fijo' })).toBe(true)
  })

  it('cargaPath arma /cargar y /cargar/:tipo', () => {
    expect(cargaPath()).toBe('/cargar')
    expect(cargaPath(null)).toBe('/cargar')
    expect(cargaPath('gasto')).toBe('/cargar/gasto')
    expect(cargaPath('fijo')).toBe('/cargar/fijo')
  })
})
