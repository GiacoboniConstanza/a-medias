import { describe, expect, it } from 'vitest'
import {
  addTimeRow,
  createTimeRows,
  dayDoseProgress,
  dosesForDay,
  firstEligibleDay,
  formatHourLabel,
  groupTreatments,
  hubSecondaryLine,
  isSlotInPeriod,
  isTreatmentArchivedView,
  isTreatmentInCourse,
  nextFreeHourOnTheHour,
  removeTimeRow,
  sortedTimeValues,
  summarizeDay,
  updateTimeRow,
  weekSummaries,
  type Medication,
  type MedicationDose,
  type MedicationPeriod,
  type MedicationSchedule,
} from './medications.ts'

const day = '2026-11-13'
const noon = new Date('2026-11-13T15:30:00.000Z') // 12:30 AR (UTC-3)

function med(partial: Partial<Medication> & Pick<Medication, 'id' | 'name'>): Medication {
  return { doseNotes: null, archivedAt: null, ...partial }
}

function period(
  medicationId: string,
  startsOn: string,
  endsOn: string | null = null,
  extra: Partial<MedicationPeriod> = {},
): MedicationPeriod {
  return {
    id: `p-${medicationId}-${startsOn}`,
    medicationId,
    startsOn,
    endsOn,
    startedAt: `${startsOn}T03:00:00.000Z`,
    endedAt: null,
    ...extra,
  }
}

describe('períodos y curso', () => {
  it('en curso si hay período abierto y no está archivado', () => {
    const m = med({ id: 'a', name: 'A' })
    const periods = [period('a', '2026-11-01')]
    expect(isTreatmentInCourse(m, periods, noon)).toBe(true)
    expect(isTreatmentArchivedView({ ...m, archivedAt: '2026-11-10T15:00:00.000Z' }, periods, noon)).toBe(true)
  })

  it('archiva a mitad del día: slots posteriores no cuentan', () => {
    const p = period('a', '2026-11-01', null, {
      endedAt: '2026-11-13T13:30:00.000Z', // 10:30 AR
    })
    expect(isSlotInPeriod(p, day, '08:00:00')).toBe(true)
    expect(isSlotInPeriod(p, day, '14:00:00')).toBe(false)
  })
})

describe('tomas del día', () => {
  const meds = [
    med({ id: 'a', name: 'Amoxicilina', doseNotes: '500 mg' }),
    med({ id: 'b', name: 'Levotiroxina', doseNotes: '1 pastilla' }),
    med({ id: 'c', name: 'Viejo', archivedAt: '2026-11-02T12:00:00.000Z' }),
  ]
  const periods = [
    period('a', '2026-11-09', '2026-11-19'),
    period('b', '2026-11-01'),
    period('c', '2026-10-01', '2026-11-02', { endedAt: '2026-11-02T12:00:00.000Z' }),
  ]
  const schedules: MedicationSchedule[] = [
    { id: 's1', medicationId: 'a', localTime: '08:00:00' },
    { id: 's2', medicationId: 'a', localTime: '14:00:00' },
    { id: 's3', medicationId: 'b', localTime: '08:00:00' },
    { id: 's4', medicationId: 'c', localTime: '09:00:00' },
  ]
  const doses: MedicationDose[] = [
    {
      id: 'd1',
      medicationId: 'b',
      doseOn: day,
      scheduledTime: '08:00:00',
      status: 'taken',
      recordedAt: '2026-11-13T11:05:00.000Z',
      nameSnapshot: 'Levotiroxina',
      doseSnapshot: '1 pastilla',
    },
  ]

  it('lista solo slots de períodos vigentes, ordenados', () => {
    const slots = dosesForDay(meds, periods, schedules, doses, day, noon)
    expect(slots.map((slot) => `${slot.name}@${formatHourLabel(slot.scheduledTime)}`)).toEqual([
      'Amoxicilina@8:00',
      'Levotiroxina@8:00',
      'Amoxicilina@14:00',
    ])
    expect(slots[1]?.status).toBe('taken')
  })

  it('resume x de y, próxima y vencidas', () => {
    const slots = dosesForDay(meds, periods, schedules, doses, day, noon)
    const summary = summarizeDay(slots, noon, day)
    expect(dayDoseProgress(slots)).toEqual({ taken: 1, skipped: 0, unmarked: 2, total: 3, nextTime: null, overdueUnmarked: 0 })
    expect(summary.taken).toBe(1)
    expect(summary.overdueUnmarked).toBe(1)
    expect(formatHourLabel(summary.nextTime!)).toBe('14:00')
    expect(hubSecondaryLine(slots, summary, noon)).toMatch(/sin marcar/)
  })
})

describe('filas de horas del formulario', () => {
  it('al sumar una segunda hora propone un valor distinto y libre', () => {
    const first = createTimeRows(['17:00'])
    const withSecond = addTimeRow(first)
    expect(withSecond).toHaveLength(2)
    expect(withSecond[1]?.time).toBe('18:00')
    expect(withSecond[1]?.time).not.toBe(withSecond[0]?.time)
    expect(withSecond[1]?.id).not.toBe(withSecond[0]?.id)
    expect(nextFreeHourOnTheHour(['17:00', '18:00'], '18:00')).toBe('19:00')
  })

  it('cambiar la primera y la segunda hora se refleja en cada fila sin reordenar', () => {
    let rows = createTimeRows(['17:00', '18:00'])
    const firstId = rows[0]!.id
    const secondId = rows[1]!.id
    rows = updateTimeRow(rows, firstId, '09:30')
    rows = updateTimeRow(rows, secondId, '21:15')
    expect(rows.map((row) => row.time)).toEqual(['09:30', '21:15'])
    expect(rows[0]?.id).toBe(firstId)
    expect(rows[1]?.id).toBe(secondId)
    expect(sortedTimeValues(rows)).toEqual(['09:30', '21:15'])
  })

  it('quitar una fila quita la correcta por id', () => {
    const rows = createTimeRows(['08:00', '14:00', '20:00'])
    const keepFirst = rows[0]!.id
    const removeMiddle = rows[1]!.id
    const keepLast = rows[2]!.id
    const next = removeTimeRow(rows, removeMiddle)
    expect(next.map((row) => row.id)).toEqual([keepFirst, keepLast])
    expect(next.map((row) => row.time)).toEqual(['08:00', '20:00'])
  })
})

describe('7 días, primer día y grupos', () => {
  it('arma semana y primer día elegible', () => {
    const meds = [med({ id: 'a', name: 'A' })]
    const periods = [period('a', '2026-11-10')]
    const schedules: MedicationSchedule[] = [{ id: 's', medicationId: 'a', localTime: '08:00:00' }]
    const week = weekSummaries(meds, periods, schedules, [], day, 7)
    expect(week[0]?.iso).toBe(day)
    expect(firstEligibleDay(periods)).toBe('2026-11-10')
  })

  it('agrupa en curso / próximo / archivado', () => {
    const meds = [
      med({ id: 'a', name: 'Ahora' }),
      med({ id: 'b', name: 'Después' }),
      med({ id: 'c', name: 'Archivo', archivedAt: '2026-11-01T12:00:00.000Z' }),
    ]
    const periods = [
      period('a', '2026-11-01'),
      period('b', '2026-11-20'),
      period('c', '2026-10-01', '2026-11-01', { endedAt: '2026-11-01T12:00:00.000Z' }),
    ]
    const groups = groupTreatments(meds, periods, noon)
    expect(groups.inCourse.map((row) => row.id)).toEqual(['a'])
    expect(groups.upcoming.map((row) => row.id)).toEqual(['b'])
    expect(groups.archived.map((row) => row.id)).toEqual(['c'])
  })
})
