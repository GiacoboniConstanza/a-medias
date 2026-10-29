import { describe, expect, it } from 'vitest'
import type { FinanceData } from './api.ts'
import { monthSplit } from './derive.ts'
import { monthSalarySplit, pocketDelta, salaryMonthError, salaryPercents, visibleSplitNotice } from './salary.ts'

const coty = [
  { effectiveFrom: '2026-01-01', amount: 900_000 },
  { effectiveFrom: '2026-11-01', amount: 1_021_622 },
]
const maru = [{ effectiveFrom: '2026-01-01', amount: 600_000 }]

describe('historial de sueldo', () => {
  const people = [
    { id: 'coty', name: 'Coty', revisions: coty, paid: 295_200 },
    { id: 'maru', name: 'Maru', revisions: maru, paid: 56_800 },
  ]

  it('octubre sigue 60/40 aunque noviembre ya tenga el aumento', () => {
    const october = monthSalarySplit({ month: '2026-10-01', total: 352_000, people })
    expect(october.rows.map((row) => row.percent)).toEqual([60, 40])
    expect(october.rows.map((row) => row.share)).toEqual([211_200, 140_800])
    expect(october.usedEvenSplit).toBe(false)
  })

  it('noviembre usa el sueldo nuevo y pasa a 63/37', () => {
    const november = monthSalarySplit({ month: '2026-11-01', total: 352_000, people })
    expect(november.rows.map((row) => row.percent)).toEqual([63, 37])
    expect(november.rows.map((row) => row.share)).toEqual([221_760, 130_240])
    expect(salaryPercents([1_021_622, 600_000])).toEqual([63, 37])
  })

  it('un mes anterior al primer sueldo no hereda el aumento', () => {
    const before = monthSalarySplit({ month: '2025-12-01', total: 100_000, people })
    expect(before.usedEvenSplit).toBe(true)
    expect(before.rows.map((row) => row.percent)).toEqual([50, 50])
  })

  it('cuenta cuánto más queda por mes con el nuevo porcentaje', () => {
    const delta = pocketDelta({
      ids: ['coty', 'maru'],
      meId: 'coty',
      oldPercentById: { coty: 60, maru: 40 },
      newPercentById: { coty: 63, maru: 37 },
      oldBase: 900_000,
      newBase: 1_021_622,
      sharedTotal: 352_000,
    })
    expect(delta).toBe(111_062)
  })
})

describe('aviso y mes del aumento', () => {
  it('no deja pisar un mes anterior al último sueldo', () => {
    const history = [
      { id: 'a', effectiveFrom: '2026-01-01' },
      { id: 'b', effectiveFrom: '2026-11-01' },
    ]
    expect(salaryMonthError(history, '2026-10-01', null)).toBe('El aumento tiene que ser posterior al último sueldo.')
    expect(salaryMonthError(history, '2026-11-01', null)).toBe('')
    expect(salaryMonthError(history, '2026-12-01', null)).toBe('')
    expect(salaryMonthError(history, '2026-10-01', 'b')).toBe('')
    expect(salaryMonthError(history, '2026-01-01', 'b')).toBe('Ese mes ya está en el historial.')
  })

  it('muestra el aviso del mes que viene y el de un cambio que sigue vigente', () => {
    const upcoming = { effectiveFrom: '2026-11-01', createdAt: '2026-10-02T12:00:00Z', label: 'noviembre' }
    const older = { effectiveFrom: '2026-08-01', createdAt: '2026-10-18T12:00:00Z', label: 'agosto' }
    expect(visibleSplitNotice([older, upcoming], '2026-10-01')?.label).toBe('noviembre')
    expect(visibleSplitNotice([older], '2026-10-01')?.label).toBe('agosto')
    expect(visibleSplitNotice([older], '2026-11-01')).toBeNull()
  })
})

describe('reparto del mes elegido', () => {
  it('usa los porcentajes del mes y no el monto de la otra', () => {
    const data = {
      names: { coty: 'Coty', maru: 'Maru' },
      bases: { coty: 900_000, maru: 9_999_999 },
      splitPercents: { coty: 60, maru: 40 },
      splitEven: false,
      monthExpenses: [
        {
          id: '1',
          title: 'Súper',
          amount: 295_200,
          spentOn: '2026-10-04',
          isShared: true,
          paidFromBag: false,
          payerId: 'coty',
          ownerId: 'coty',
          categoryId: 'super',
        },
        {
          id: '2',
          title: 'Luz',
          amount: 56_800,
          spentOn: '2026-10-08',
          isShared: true,
          paidFromBag: false,
          payerId: 'maru',
          ownerId: 'maru',
          categoryId: 'luz',
        },
      ],
    } as unknown as FinanceData
    const split = monthSplit(data)
    expect(split.rows.map((row) => row.percent)).toEqual([60, 40])
    expect(split.rows.map((row) => row.share)).toEqual([211_200, 140_800])
    expect(split.amount).toBe(84_000)
  })
})
