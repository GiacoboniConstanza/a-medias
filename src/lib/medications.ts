/** Dominio puro de medicamentos (sin I/O). */
import { argentinaISO } from './meals.ts'

export type Medication = {
  id: string
  name: string
  doseNotes: string | null
  archivedAt: string | null
}

export type MedicationPeriod = {
  id: string
  medicationId: string
  startsOn: string
  endsOn: string | null
  startedAt: string
  endedAt: string | null
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
  nameSnapshot: string
  doseSnapshot: string | null
}

export type DayDoseSlot = {
  medicationId: string
  name: string
  doseNotes: string | null
  scheduledTime: string
  status: DoseStatus | null
  recordedAt: string | null
  endsOn: string | null
}

export type DaySummary = {
  taken: number
  skipped: number
  unmarked: number
  total: number
  nextTime: string | null
  overdueUnmarked: number
}

export type WeekDaySummary = {
  iso: string
  taken: number
  total: number
  skipped: number
  unmarked: number
  slots: DayDoseSlot[]
}

function normalizeTime(value: string): string {
  const parts = value.split(':')
  const hh = (parts[0] ?? '00').padStart(2, '0')
  const mm = (parts[1] ?? '00').padStart(2, '0')
  const ss = (parts[2] ?? '00').padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

export function formatHourLabel(time: string): string {
  const [hh, mm] = normalizeTime(time).split(':')
  const hour = Number(hh)
  return `${hour}:${mm}`
}

export function currentPeriod(
  periods: readonly MedicationPeriod[],
  medicationId: string,
  at: Date = new Date(),
): MedicationPeriod | null {
  const iso = argentinaISO(at)
  const atMs = at.getTime()
  const open = periods
    .filter((period) => period.medicationId === medicationId)
    .filter((period) => period.startsOn <= iso && (period.endsOn === null || period.endsOn >= iso))
    .filter((period) => {
      const started = new Date(period.startedAt).getTime()
      if (started > atMs) return false
      if (period.endedAt && new Date(period.endedAt).getTime() <= atMs) return false
      return true
    })
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  return open[0] ?? null
}

export function latestPeriod(periods: readonly MedicationPeriod[], medicationId: string): MedicationPeriod | null {
  return periods
    .filter((period) => period.medicationId === medicationId)
    .slice()
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] ?? null
}

function argentinaParts(date: Date): { h: string; m: string; s: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)
  return {
    h: parts.find((part) => part.type === 'hour')?.value ?? '00',
    m: parts.find((part) => part.type === 'minute')?.value ?? '00',
    s: parts.find((part) => part.type === 'second')?.value ?? '00',
  }
}

/** ¿El slot (día+hora) cae dentro de un período de uso? */
export function isSlotInPeriod(period: MedicationPeriod, day: string, scheduledTime: string): boolean {
  if (day < period.startsOn) return false
  if (period.endsOn && day > period.endsOn) return false
  const started = new Date(period.startedAt)
  const startedDay = argentinaISO(started)
  if (day < startedDay) return false
  if (day === startedDay) {
    const t = argentinaParts(started)
    const startedTime = `${t.h.padStart(2, '0')}:${t.m}:${t.s}`
    if (normalizeTime(scheduledTime) < startedTime) return false
  }
  if (period.endedAt) {
    const ended = new Date(period.endedAt)
    const endedDay = argentinaISO(ended)
    if (day > endedDay) return false
    if (day === endedDay) {
      const t = argentinaParts(ended)
      const endedTime = `${t.h.padStart(2, '0')}:${t.m}:${t.s}`
      if (normalizeTime(scheduledTime) >= endedTime) return false
    }
  }
  return true
}

export function isTreatmentInCourse(med: Medication, periods: readonly MedicationPeriod[], at: Date = new Date()): boolean {
  if (med.archivedAt) return false
  return currentPeriod(periods, med.id, at) !== null
}

export function isTreatmentUpcoming(med: Medication, periods: readonly MedicationPeriod[], at: Date = new Date()): boolean {
  if (med.archivedAt) return false
  const iso = argentinaISO(at)
  const future = periods
    .filter((period) => period.medicationId === med.id && period.startsOn > iso && !period.endedAt)
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn))
  return future.length > 0 && currentPeriod(periods, med.id, at) === null
}

export function isTreatmentArchivedView(med: Medication, periods: readonly MedicationPeriod[], at: Date = new Date()): boolean {
  if (med.archivedAt) return true
  if (isTreatmentInCourse(med, periods, at) || isTreatmentUpcoming(med, periods, at)) return false
  const latest = latestPeriod(periods, med.id)
  if (!latest) return true
  const iso = argentinaISO(at)
  return Boolean(latest.endsOn && latest.endsOn < iso) || Boolean(latest.endedAt)
}

/** Tomas del día a partir de horas + períodos (sin inventar filas). */
export function dosesForDay(
  medications: readonly Medication[],
  periods: readonly MedicationPeriod[],
  schedules: readonly MedicationSchedule[],
  doses: readonly MedicationDose[],
  day: string,
  _at: Date = new Date(),
): DayDoseSlot[] {
  void _at
  const slots: DayDoseSlot[] = []
  for (const med of medications) {
    const covering = periods.filter(
      (row) =>
        row.medicationId === med.id &&
        row.startsOn <= day &&
        (row.endsOn === null || row.endsOn >= day),
    )
    if (covering.length === 0) continue

    const times = schedules
      .filter((schedule) => schedule.medicationId === med.id)
      .slice()
      .sort((a, b) => normalizeTime(a.localTime).localeCompare(normalizeTime(b.localTime)))

    for (const schedule of times) {
      const activePeriod = covering.find((row) => isSlotInPeriod(row, day, schedule.localTime))
      if (!activePeriod) continue
      const recorded = doses.find(
        (dose) =>
          dose.medicationId === med.id &&
          dose.doseOn === day &&
          normalizeTime(dose.scheduledTime) === normalizeTime(schedule.localTime),
      )
      slots.push({
        medicationId: med.id,
        name: recorded?.nameSnapshot ?? med.name,
        doseNotes: recorded?.doseSnapshot ?? med.doseNotes,
        scheduledTime: normalizeTime(schedule.localTime),
        status: recorded?.status ?? null,
        recordedAt: recorded?.recordedAt ?? null,
        endsOn: activePeriod.endsOn,
      })
    }
  }

  return slots.sort(
    (a, b) =>
      normalizeTime(a.scheduledTime).localeCompare(normalizeTime(b.scheduledTime)) ||
      a.name.localeCompare(b.name, 'es'),
  )
}

export function dayDoseProgress(slots: readonly DayDoseSlot[]): DaySummary {
  const taken = slots.filter((slot) => slot.status === 'taken').length
  const skipped = slots.filter((slot) => slot.status === 'skipped').length
  const unmarked = slots.filter((slot) => slot.status === null).length
  return { taken, skipped, unmarked, total: slots.length, nextTime: null, overdueUnmarked: 0 }
}

export function summarizeDay(
  slots: readonly DayDoseSlot[],
  now: Date = new Date(),
  day: string = argentinaISO(now),
): DaySummary {
  const base = dayDoseProgress(slots)
  const nowParts = argentinaParts(now)
  const nowTime = `${nowParts.h.padStart(2, '0')}:${nowParts.m}:${nowParts.s}`
  const today = argentinaISO(now)
  let overdueUnmarked = 0
  let nextTime: string | null = null
  for (const slot of slots) {
    if (slot.status !== null) continue
    if (day < today || (day === today && normalizeTime(slot.scheduledTime) < nowTime)) {
      overdueUnmarked += 1
    } else if (day === today && nextTime === null) {
      nextTime = slot.scheduledTime
    }
  }
  return { ...base, nextTime, overdueUnmarked }
}

export function nextDoseLabel(summary: DaySummary): string {
  if (summary.total === 0) return 'Nada para hoy'
  if (summary.taken === summary.total) return `Las ${summary.total} tomas de hoy, listas.`
  if (summary.overdueUnmarked > 0) {
    const n = summary.overdueUnmarked
    return n === 1 ? 'Una sin marcar, de las 8:00.' : `${n} sin marcar.`
  }
  if (summary.nextTime) return `La próxima, a las ${formatHourLabel(summary.nextTime)}.`
  return `${summary.taken} de ${summary.total} tomas hoy`
}

/** Hub M2: línea secundaria con hora de la vencida si hay una sola. */
export function hubSecondaryLine(slots: readonly DayDoseSlot[], summary: DaySummary, now: Date = new Date()): string {
  if (summary.total === 0) return 'Nada para hoy'
  if (summary.taken === summary.total) return `Las ${summary.total} tomas de hoy, listas.`
  if (summary.overdueUnmarked === 1) {
    const overdue = slots.find((slot) => {
      if (slot.status !== null) return false
      const parts = argentinaParts(now)
      const nowTime = `${parts.h.padStart(2, '0')}:${parts.m}:${parts.s}`
      return normalizeTime(slot.scheduledTime) < nowTime
    })
    if (overdue) return `Una sin marcar, de las ${formatHourLabel(overdue.scheduledTime)}.`
  }
  if (summary.overdueUnmarked > 1) return `${summary.overdueUnmarked} sin marcar.`
  if (summary.nextTime) return `La próxima, a las ${formatHourLabel(summary.nextTime)}.`
  return `${summary.taken} de ${summary.total}`
}

export function weekSummaries(
  medications: readonly Medication[],
  periods: readonly MedicationPeriod[],
  schedules: readonly MedicationSchedule[],
  doses: readonly MedicationDose[],
  today: string,
  days = 7,
): WeekDaySummary[] {
  const out: WeekDaySummary[] = []
  for (let offset = 0; offset < days; offset += 1) {
    const [y, m, d] = today.split('-').map(Number)
    const utc = new Date(Date.UTC(y, m - 1, d - offset, 15, 0, 0))
    const iso = argentinaISO(utc)
    const slots = dosesForDay(medications, periods, schedules, doses, iso)
    if (slots.length === 0 && offset > 0) continue
    const progress = dayDoseProgress(slots)
    out.push({
      iso,
      taken: progress.taken,
      total: progress.total,
      skipped: progress.skipped,
      unmarked: progress.unmarked,
      slots,
    })
  }
  return out
}

export function firstEligibleDay(periods: readonly MedicationPeriod[]): string | null {
  if (periods.length === 0) return null
  return periods.map((period) => period.startsOn).sort()[0] ?? null
}

export function groupTreatments(
  medications: readonly Medication[],
  periods: readonly MedicationPeriod[],
  at: Date = new Date(),
): { inCourse: Medication[]; upcoming: Medication[]; archived: Medication[] } {
  const inCourse: Medication[] = []
  const upcoming: Medication[] = []
  const archived: Medication[] = []
  for (const med of medications) {
    if (isTreatmentInCourse(med, periods, at)) inCourse.push(med)
    else if (isTreatmentUpcoming(med, periods, at)) upcoming.push(med)
    else archived.push(med)
  }
  const byName = (a: Medication, b: Medication) => a.name.localeCompare(b.name, 'es')
  return {
    inCourse: inCourse.sort(byName),
    upcoming: upcoming.sort(byName),
    archived: archived.sort(byName),
  }
}

export function maxSchedules(): number {
  return 6
}
