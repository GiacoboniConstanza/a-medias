import { describe, expect, it } from 'vitest'
import {
  dayDoseProgress,
  dosesForDay,
  isTreatmentActive,
  isTreatmentEnded,
  type Medication,
  type MedicationDose,
  type MedicationSchedule,
} from './medications.ts'

const day = new Date(2026, 10, 13) // 2026-11-13

function med(partial: Partial<Medication> & Pick<Medication, 'id' | 'name'>): Medication {
  return {
    doseNotes: null,
    startsOn: '2026-11-01',
    endsOn: null,
    active: true,
    ...partial,
  }
}

describe('tratamiento vigente / terminado', () => {
  it('activo dentro de la ventana', () => {
    const ibuprofeno = med({ id: '1', name: 'Ibuprofeno', startsOn: '2026-11-10', endsOn: '2026-11-20' })
    expect(isTreatmentActive(ibuprofeno, day)).toBe(true)
    expect(isTreatmentEnded(ibuprofeno, day)).toBe(false)
  })

  it('terminó si ends_on ya pasó o está inactivo', () => {
    const corto = med({ id: '2', name: 'Amoxi', startsOn: '2026-11-01', endsOn: '2026-11-10' })
    expect(isTreatmentActive(corto, day)).toBe(false)
    expect(isTreatmentEnded(corto, day)).toBe(true)
    expect(isTreatmentEnded(med({ id: '3', name: 'X', active: false }), day)).toBe(true)
  })

  it('aún no empezó', () => {
    const futuro = med({ id: '4', name: 'Futuro', startsOn: '2026-12-01' })
    expect(isTreatmentActive(futuro, day)).toBe(false)
    expect(isTreatmentEnded(futuro, day)).toBe(false)
  })
})

describe('tomas del día', () => {
  const meds = [
    med({ id: 'a', name: 'A', doseNotes: '1 pastilla' }),
    med({ id: 'b', name: 'B', endsOn: '2026-11-01' }),
  ]
  const schedules: MedicationSchedule[] = [
    { id: 's1', medicationId: 'a', localTime: '21:00:00' },
    { id: 's2', medicationId: 'a', localTime: '08:00:00' },
    { id: 's3', medicationId: 'b', localTime: '09:00:00' },
  ]
  const doses: MedicationDose[] = [
    {
      id: 'd1',
      medicationId: 'a',
      doseOn: '2026-11-13',
      scheduledTime: '08:00:00',
      status: 'taken',
      recordedAt: '2026-11-13T11:00:00Z',
    },
  ]

  it('solo lista horarios de tratamientos vigentes, ordenados', () => {
    const slots = dosesForDay(meds, schedules, doses, day)
    expect(slots.map((slot) => `${slot.name}@${slot.scheduledTime}`)).toEqual([
      'A@08:00:00',
      'A@21:00:00',
    ])
    expect(slots[0]?.status).toBe('taken')
    expect(slots[1]?.status).toBeNull()
  })

  it('cuenta progreso del día', () => {
    const slots = dosesForDay(meds, schedules, doses, day)
    expect(dayDoseProgress(slots)).toEqual({ taken: 1, total: 2, skipped: 0 })
  })
})
