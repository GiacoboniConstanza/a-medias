import { describe, expect, it } from 'vitest'
import {
  contributionMonths,
  evenMonthlyShare,
  goalPaceLine,
  goalPhrase,
  goalProgress,
  monthsLeftCopy,
  monthsUntil,
  salaryShare,
  shareLabel,
} from './goal.ts'

describe('progreso de la meta', () => {
  it('muestra un arco mínimo cuando todavía no llega al 1%', () => {
    expect(goalProgress(1000, 1_000_000)).toEqual({ label: '<1%', arc: 0.015 })
    expect(goalProgress(0, 1_000_000)).toEqual({ label: '0%', arc: 0 })
  })

  it('cambia la frase según el avance', () => {
    expect(goalPhrase(0, 1_000_000)).toBe('¡Arrancaron! Cada aporte suma')
    expect(goalPhrase(900_000, 1_000_000)).toBe('Ya casi llegan')
    expect(goalPhrase(1_000_000, 1_000_000)).toBe('¡Llegaron a la meta!')
  })

  it('cuenta los meses hasta la fecha y reparte lo que falta', () => {
    expect(monthsUntil('2027-03-01', new Date(2026, 9, 20))).toBe(5)
    expect(monthsLeftCopy(5)).toBe('faltan 5 meses')
    expect(monthsLeftCopy(1)).toBe('falta 1 mes')
    expect(evenMonthlyShare(1_000_000, 5)).toBe(100_000)
    expect(salaryShare(1_000_000, 5, 60)).toBe(120_000)
  })

  it('marca una parte chica sin redondearla a cero', () => {
    expect(shareLabel(1, 1_000)).toBe('<1%')
    expect(shareLabel(0, 100)).toBe('0%')
  })

  it('arma la línea de ritmo y agrupa los aportes por mes', () => {
    expect(goalPaceLine('2027-03-01', 5, 100_000)).toBe(
      'Marzo 2027 · faltan 5 meses · Si cada una suma $ 100.000 por mes, llegan',
    )
    expect(
      contributionMonths([
        { createdAt: '2026-01-15T15:00:00.000Z', amount: 1000 },
        { createdAt: '2026-01-20T15:00:00.000Z', amount: 500 },
        { createdAt: '2026-03-02T15:00:00.000Z', amount: 200 },
      ]),
    ).toEqual([
      { month: '2026-01-01', amount: 1500 },
      { month: '2026-02-01', amount: 0 },
      { month: '2026-03-01', amount: 200 },
    ])
  })
})
