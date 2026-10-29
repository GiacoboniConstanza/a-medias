import { describe, expect, it } from 'vitest'
import {
  amountForMonth,
  dueBucket,
  dueLabel,
  dueTone,
  dueVisual,
  editedCaption,
  scheduleAmount,
  shareSentence,
  showPayLink,
  withRevision,
} from './fixed.ts'

describe('historial de montos', () => {
  const rent = [
    { effectiveFrom: '2026-01-01', amount: 250000 },
    { effectiveFrom: '2026-11-01', amount: 300000 },
  ]

  it('octubre conserva el monto anterior cuando noviembre aumenta', () => {
    expect(amountForMonth(rent, '2026-10-01')).toBe(250000)
    expect(amountForMonth(rent, '2026-11-01')).toBe(300000)
    expect(amountForMonth(rent, '2026-12-01')).toBe(300000)
  })

  it('no muestra un gasto en meses anteriores a su vigencia', () => {
    expect(amountForMonth(rent, '2025-12-01')).toBeNull()
  })

  it('reemplaza solo la revisión de ese mes', () => {
    const next = withRevision(rent, { effectiveFrom: '2026-11-01', amount: 320000 })
    expect(amountForMonth(next, '2026-10-01')).toBe(250000)
    expect(amountForMonth(next, '2026-11-01')).toBe(320000)
  })

  it('el monto guardado en la ficha es el del mes calendario', () => {
    const revision = { effectiveFrom: '2026-11-01', amount: 300000 }
    expect(scheduleAmount([{ effectiveFrom: '2026-01-01', amount: 250000 }], '2026-10-01', revision)).toBe(250000)
    expect(scheduleAmount([{ effectiveFrom: '2026-01-01', amount: 250000 }], '2026-11-01', revision)).toBe(300000)
  })
})

describe('vencimientos', () => {
  const today = new Date(2026, 9, 20, 12, 0, 0)

  it('marca vencido solo si el día ya pasó, y próximo en neutro', () => {
    expect(dueVisual(18, '2026-10-01', today)).toBe('late')
    expect(dueVisual(20, '2026-10-01', today)).toBe('upcoming')
    expect(dueVisual(25, '2026-10-01', today)).toBe('upcoming')
    expect(dueVisual(1, '2026-11-01', today)).toBe('upcoming')
    expect(dueVisual(28, '2026-09-01', today)).toBe('late')
  })

  it('describe el vencimiento en texto corto', () => {
    expect(dueLabel(18, '2026-10-01', today)).toBe('Venció hace 2 días')
    expect(dueLabel(19, '2026-10-01', today)).toBe('Venció hace 1 día')
    expect(dueLabel(20, '2026-10-01', today)).toBe('Hoy')
    expect(dueLabel(21, '2026-10-01', today)).toBe('en 1 día')
    expect(dueLabel(23, '2026-10-01', today)).toBe('en 3 días')
    expect(dueLabel(1, '2026-09-01', today)).toBe('Venció hace 49 días')
    expect(dueLabel(1, '2026-11-01', today)).toBe('en 12 días')
  })

  it('agrupa hoy, esta semana y más adelante', () => {
    expect(dueBucket(20, '2026-10-01', today)).toBe('today')
    expect(dueBucket(18, '2026-10-01', today)).toBe('today')
    expect(dueBucket(23, '2026-10-01', today)).toBe('week')
    expect(dueBucket(28, '2026-10-01', today)).toBe('later')
    expect(dueTone(20, '2026-10-01', today)).toBe('today')
    expect(dueTone(23, '2026-10-01', today)).toBe('soon')
    expect(dueTone(18, '2026-10-01', today)).toBe('late')
    expect(showPayLink(20, '2026-10-01', today)).toBe(true)
    expect(showPayLink(18, '2026-10-01', today)).toBe(true)
    expect(showPayLink(23, '2026-10-01', today)).toBe(false)
  })

  it('arma el reparto con el porcentaje real', () => {
    expect(shareSentence(60, 40, 'Maru', false)).toBe('Se reparte 60/40 con Maru por sueldo base')
    expect(shareSentence(50, 50, 'Maru', true)).toBe('Se reparte 50/50 con Maru')
  })
})

describe('quién editó', () => {
  it('arma la leyenda con el nombre y el día', () => {
    const updatedAt = new Date(2026, 9, 20, 15, 0, 0).toISOString()
    expect(editedCaption(updatedAt, 'Coty')).toBe('Editado por Coty el 20/10')
  })
})
