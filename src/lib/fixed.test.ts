import { describe, expect, it } from 'vitest'
import {
  amountForMonth,
  appliesForMonth,
  dueBucket,
  dueLabel,
  dueTone,
  dueVisual,
  editedCaption,
  firstMonthCaption,
  firstMonthFromCurrent,
  installmentAmountFromTotal,
  installmentLabel,
  installmentNumber,
  remainingPayoff,
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

  it('un mes vaciado queda sin monto y el siguiente arrastra', () => {
    const cleared = new Set(['2026-11-01'])
    expect(amountForMonth(rent, '2026-11-01', cleared)).toBeNull()
    expect(amountForMonth(rent, '2026-12-01', cleared)).toBe(300000)
    expect(appliesForMonth(rent, '2026-11-01', cleared)).toBe(true)
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
    expect(shareSentence(60, 40, 'Maru', false)).toBe('Se reparte 60/40 con Maru por sueldo')
    expect(shareSentence(50, 50, 'Maru', true)).toBe('Se reparte 50/50 con Maru')
  })
})

describe('quién editó', () => {
  it('arma la leyenda con el nombre y el día', () => {
    const updatedAt = new Date(2026, 9, 20, 15, 0, 0).toISOString()
    expect(editedCaption(updatedAt, 'Coty')).toBe('Editado por Coty el 20/10')
  })
})

describe('cuotas', () => {
  const plan = { firstMonth: '2026-07-01', count: 18 }
  const revisions = [{ effectiveFrom: '2026-07-01', amount: 212_265.83 }]

  it('calcula la cuota redondeada a 2 decimales sin ajuste en la última', () => {
    expect(installmentAmountFromTotal(3_820_784.98, 18)).toBe(212_265.83)
    expect(normalizeMoneyTimes(212_265.83, 18)).toBe(3_820_784.94)
  })

  it('calcula el mes de la primera desde «va por la cuota»', () => {
    expect(firstMonthFromCurrent('2026-11-01', 5)).toBe('2026-07-01')
    expect(firstMonthFromCurrent('2026-11-01', 1)).toBe('2026-11-01')
    expect(firstMonthCaption('2026-07-01')).toBe('La primera queda en julio de 2026')
  })

  it('arma el texto cuota n/N y resto', () => {
    expect(installmentLabel(1, 18)).toBe('cuota 1/18')
    expect(installmentLabel(5, 18)).toBe('cuota 5/18')
    expect(installmentLabel(18, 18, { resto: true })).toBe('resto')
  })

  it('corta el plazo: fuera de la ventana no aplica', () => {
    expect(installmentNumber(plan, '2026-11-01')).toBe(5)
    expect(amountForMonth(revisions, '2026-11-01', [], plan)).toBe(212_265.83)
    expect(amountForMonth(revisions, '2026-06-01', [], plan)).toBeNull()
    expect(appliesForMonth(revisions, '2028-01-01', [], plan)).toBe(false)
    expect(appliesForMonth(revisions, '2026-12-01', [], plan)).toBe(true)
  })

  it('Pagué el resto: cubre las impagas del mes visible', () => {
    expect(remainingPayoff(212_265.83, 18, 5, false)).toEqual({
      covered: 14,
      amount: 2_971_721.62,
    })
    expect(remainingPayoff(212_265.83, 18, 5, true)).toEqual({
      covered: 13,
      amount: 2_759_455.79,
    })
  })
})

function normalizeMoneyTimes(amount: number, times: number): number {
  return Math.round(amount * 100 * times) / 100
}
