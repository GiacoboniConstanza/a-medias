/** Dominio puro de medicamentos (sin I/O). */

export type Medication = {
  id: string
  name: string
  doseNotes: string | null
  startsOn: string
  endsOn: string | null
  active: boolean
}

export type MedicationSchedule = {
  id: string
  medicationId: string
  localTime: string
}

export type DoseStatus = 'taken' | 'skipped'

export type MedicationDose = {
  id: string
  medicationId: string
  doseOn: string
  scheduledTime: string
  status: DoseStatus
  recordedAt: string
}

export type DayDoseSlot = {
  medicationId: string
  name: string
  doseNotes: string | null
  scheduledTime: string
  status: DoseStatus | null
}

function isoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Tratamiento vigente en `day` (activo y dentro de la ventana de fechas). */
export function isTreatmentActive(med: Medication, day: Date = new Date()): boolean {
  if (!med.active) return false
  const iso = isoDate(day)
  if (iso < med.startsOn) return false
  if (med.endsOn && iso > med.endsOn) return false
  return true
}

export function isTreatmentEnded(med: Medication, day: Date = new Date()): boolean {
  if (!med.active) return true
  if (med.endsOn && isoDate(day) > med.endsOn) return true
  return false
}

/** Tomas del día: un slot por horario de cada medicamento vigente. */
export function dosesForDay(
  medications: readonly Medication[],
  schedules: readonly MedicationSchedule[],
  doses: readonly MedicationDose[],
  day: Date,
): DayDoseSlot[] {
  const iso = isoDate(day)
  const active = medications.filter((med) => isTreatmentActive(med, day))
  const slots: DayDoseSlot[] = []

  for (const med of active) {
    const times = schedules
      .filter((schedule) => schedule.medicationId === med.id)
      .slice()
      .sort((a, b) => a.localTime.localeCompare(b.localTime))

    for (const schedule of times) {
      const recorded = doses.find(
        (dose) =>
          dose.medicationId === med.id &&
          dose.doseOn === iso &&
          dose.scheduledTime === schedule.localTime,
      )
      slots.push({
        medicationId: med.id,
        name: med.name,
        doseNotes: med.doseNotes,
        scheduledTime: schedule.localTime,
        status: recorded?.status ?? null,
      })
    }
  }

  return slots.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime) || a.name.localeCompare(b.name))
}

export function dayDoseProgress(slots: readonly DayDoseSlot[]): { taken: number; total: number; skipped: number } {
  const taken = slots.filter((slot) => slot.status === 'taken').length
  const skipped = slots.filter((slot) => slot.status === 'skipped').length
  return { taken, total: slots.length, skipped }
}
