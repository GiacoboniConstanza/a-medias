/** Dominio puro de medicamentos (sin I/O). */
import { argentinaISO, shiftArgentinaISO } from './meals.ts'

export type Medication = {
  id: string
  name: string
  doseNotes: string | null
  archivedAt: string | null
  /** null = sin stock registrado */
  stockQty: number | null
  unitsPerDose: number
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
  unitsDeducted: number
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

/** Fila de hora del formulario: identidad estable distinta del valor HH:MM. */
export type MedicationTimeRow = {
  id: string
  time: string
}

function newTimeRowId(): string {
  return crypto.randomUUID()
}

/** Próxima hora en punto según el reloj de Argentina. */
export function nextHourOnTheHour(at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(at)
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0')
  const next = (hour + 1) % 24
  return `${String(next).padStart(2, '0')}:00`
}

/** Primera hora en punto libre siguiente a `afterTime` (no repite las existentes). */
export function nextFreeHourOnTheHour(existingTimes: readonly string[], afterTime: string): string {
  const occupied = new Set(existingTimes.map((time) => time.slice(0, 5)))
  const hour = Number((afterTime.slice(0, 5).split(':')[0] ?? '0'))
  for (let step = 1; step <= 24; step += 1) {
    const candidate = `${String((hour + step) % 24).padStart(2, '0')}:00`
    if (!occupied.has(candidate)) return candidate
  }
  return `${String((hour + 1) % 24).padStart(2, '0')}:00`
}

export function createTimeRows(times: readonly string[]): MedicationTimeRow[] {
  return times.map((time) => ({ id: newTimeRowId(), time: time.slice(0, 5) }))
}

export function sortedTimeValues(rows: readonly MedicationTimeRow[]): string[] {
  return rows.map((row) => row.time.slice(0, 5)).slice().sort()
}

export function addTimeRow(rows: readonly MedicationTimeRow[], at: Date = new Date()): MedicationTimeRow[] {
  const existing = rows.map((row) => row.time.slice(0, 5))
  const after = existing[existing.length - 1] ?? nextHourOnTheHour(at)
  const time = existing.length === 0 ? nextHourOnTheHour(at) : nextFreeHourOnTheHour(existing, after)
  return [...rows, { id: newTimeRowId(), time }]
}

export function updateTimeRow(
  rows: readonly MedicationTimeRow[],
  id: string,
  time: string,
): MedicationTimeRow[] {
  return rows.map((row) => (row.id === id ? { ...row, time: time.slice(0, 5) } : row))
}

export function removeTimeRow(rows: readonly MedicationTimeRow[], id: string): MedicationTimeRow[] {
  return rows.filter((row) => row.id !== id)
}

/** Consumo diario = cantidad de horas × unidades por toma (S14). */
export function dailyConsumption(scheduleCount: number, unitsPerDose: number): number {
  if (scheduleCount <= 0 || unitsPerDose <= 0) return 0
  return scheduleCount * unitsPerDose
}

/** Días que alcanza = floor(stock / consumo diario). */
export function daysStockLasts(stockQty: number, daily: number): number | null {
  if (daily <= 0) return null
  if (stockQty < 0) return 0
  return Math.floor(stockQty / daily)
}

export function formatStockDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function addDaysToIso(iso: string, days: number): string {
  return shiftArgentinaISO(iso, days)
}

export type StockEstimate = {
  daily: number
  daysLeft: number | null
  /** ISO de la fecha estimada, o null si no aplica */
  estimatedOn: string | null
  /** S17: la fecha cae después del fin del tratamiento */
  reachesUntilEnd: boolean
  lowStock: boolean
  outOfStock: boolean
}

/**
 * Fecha estimada = día de arranque + floor(stock / consumo).
 * El arranque es hoy, o el Desde si el tratamiento empieza más adelante (S14, S21).
 */
export function estimateStock(
  stockQty: number | null,
  scheduleCount: number,
  unitsPerDose: number,
  today: string,
  treatmentStartsOn: string | null = null,
  treatmentEndsOn: string | null = null,
): StockEstimate {
  const daily = dailyConsumption(scheduleCount, unitsPerDose)
  if (stockQty == null) {
    return {
      daily,
      daysLeft: null,
      estimatedOn: null,
      reachesUntilEnd: false,
      lowStock: false,
      outOfStock: false,
    }
  }
  if (stockQty === 0) {
    return {
      daily,
      daysLeft: 0,
      estimatedOn: null,
      reachesUntilEnd: false,
      lowStock: true,
      outOfStock: true,
    }
  }
  const daysLeft = daysStockLasts(stockQty, daily)
  if (daysLeft == null) {
    return {
      daily,
      daysLeft: null,
      estimatedOn: null,
      reachesUntilEnd: false,
      lowStock: false,
      outOfStock: false,
    }
  }
  const fromDay =
    treatmentStartsOn && treatmentStartsOn > today ? treatmentStartsOn : today
  const estimatedOn = addDaysToIso(fromDay, daysLeft)
  const reachesUntilEnd = Boolean(treatmentEndsOn && estimatedOn > treatmentEndsOn)
  const lowStock = daysLeft <= 3
  return {
    daily,
    daysLeft,
    estimatedOn: reachesUntilEnd ? treatmentEndsOn : estimatedOn,
    reachesUntilEnd,
    lowStock,
    outOfStock: false,
  }
}

export function isStockLow(stockQty: number | null, scheduleCount: number, unitsPerDose: number): boolean {
  if (stockQty == null) return false
  if (stockQty === 0) return true
  const days = daysStockLasts(stockQty, dailyConsumption(scheduleCount, unitsPerDose))
  return days != null && days <= 3
}

export type StockCardModel = {
  medication: Medication
  scheduleCount: number
  startsOn: string | null
  endsOn: string | null
  upcoming: boolean
  estimate: StockEstimate
}

/** Orden S22: 0 → stock bajo → resto por fecha estimada → sin registrar; empates por nombre. */
export function sortStockCards(cards: readonly StockCardModel[]): StockCardModel[] {
  return cards.slice().sort((a, b) => {
    const rank = (card: StockCardModel): number => {
      if (card.medication.stockQty == null) return 3
      if (card.estimate.outOfStock || card.medication.stockQty === 0) return 0
      if (card.estimate.lowStock) return 1
      return 2
    }
    const ra = rank(a)
    const rb = rank(b)
    if (ra !== rb) return ra - rb
    if (ra === 2 && rb === 2) {
      const ea = a.estimate.estimatedOn ?? '9999-99-99'
      const eb = b.estimate.estimatedOn ?? '9999-99-99'
      if (ea !== eb) return ea.localeCompare(eb)
    }
    return a.medication.name.localeCompare(b.medication.name, 'es')
  })
}

/** Bajada del bloque Stock (S18). */
export function stockHeaderSummary(cards: readonly StockCardModel[]): string | null {
  if (cards.length === 0) return null
  const low = cards.filter((card) => card.medication.stockQty != null && card.estimate.lowStock).length
  const unregistered = cards.filter((card) => card.medication.stockQty == null).length
  if (low === 0 && unregistered === 0) return 'Todos con stock para más de 3 días.'
  const parts: string[] = []
  if (low > 0) parts.push(`${low} con stock bajo`)
  if (unregistered > 0) parts.push(`${unregistered} sin registrar`)
  return parts.join(' · ')
}

/** Cuenta en texto del formulario (S10). */
export function stockDailyAccountLabel(scheduleCount: number, unitsPerDose: number): string {
  const daily = dailyConsumption(scheduleCount, unitsPerDose)
  const tomaWord = scheduleCount === 1 ? 'toma' : 'tomas'
  const unitWord = unitsPerDose === 1 ? 'unidad' : 'unidades'
  const dailyWord = daily === 1 ? 'unidad' : 'unidades'
  return `${daily} ${dailyWord} por día: ${scheduleCount} ${tomaWord} de ${unitsPerDose} ${unitWord}.`
}

/**
 * En Tomas (S26): índice de la fila donde mostrar el aviso de stock bajo
 * (próxima sin marcar; si todas marcadas, la última del día).
 */
export function stockHintSlotIndex(slots: readonly DayDoseSlot[], medicationId: string): number {
  const indexes: number[] = []
  slots.forEach((slot, index) => {
    if (slot.medicationId === medicationId) indexes.push(index)
  })
  if (indexes.length === 0) return -1
  const nextUnmarked = indexes.find((index) => slots[index]?.status === null)
  if (nextUnmarked != null) return nextUnmarked
  return indexes[indexes.length - 1] ?? -1
}
