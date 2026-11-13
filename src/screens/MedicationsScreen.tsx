import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { AppIcon } from '../components/AppIcon.tsx'
import { Fab, FabSpace } from '../components/Fab.tsx'
import { SectionHeader } from '../components/SectionHeader.tsx'
import { Sheet } from '../components/Sheet.tsx'
import { Sprout } from '../components/Sprout.tsx'
import { Button, Toast } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import {
  clearMedicationDose,
  loadMedicationDosesBetween,
  loadMedicationDosesForDay,
  loadMedicationPeriods,
  loadMedications,
  loadMedicationSchedules,
  loadModuleNotificationPrefs,
  setMedicationDose,
  type MedicationDoseRow,
  type MedicationPeriodRow,
  type MedicationRow,
  type MedicationScheduleRow,
} from '../lib/api.ts'
import { argentinaISO, shiftArgentinaISO } from '../lib/meals.ts'
import {
  dosesForDay,
  firstEligibleDay,
  formatHourLabel,
  summarizeDay,
  weekSummaries,
  type DayDoseSlot,
} from '../lib/medications.ts'
import { pushIsConfigured, isIosWithoutPwa } from '../lib/push/permissions.ts'

function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const label = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function groupByHour(slots: DayDoseSlot[]): { time: string; items: DayDoseSlot[] }[] {
  const map = new Map<string, DayDoseSlot[]>()
  for (const slot of slots) {
    const list = map.get(slot.scheduledTime) ?? []
    list.push(slot)
    map.set(slot.scheduledTime, list)
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, items]) => ({ time, items }))
}

export function MedicationsScreen() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const today = argentinaISO()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [medications, setMedications] = useState<MedicationRow[]>([])
  const [periods, setPeriods] = useState<MedicationPeriodRow[]>([])
  const [schedules, setSchedules] = useState<MedicationScheduleRow[]>([])
  const [doses, setDoses] = useState<MedicationDoseRow[]>([])
  const [weekDoses, setWeekDoses] = useState<MedicationDoseRow[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [takeSlot, setTakeSlot] = useState<DayDoseSlot | null>(null)
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null)
  const [pushHint, setPushHint] = useState<'off' | 'blocked' | 'ios' | null>(null)

  const reload = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    setError('')
    try {
      const from = shiftArgentinaISO(today, -6)
      const [meds, pers, scheds, dayDoses, rangeDoses, prefs] = await Promise.all([
        loadMedications(profile.id),
        loadMedicationPeriods(profile.id),
        loadMedicationSchedules(profile.id),
        loadMedicationDosesForDay(profile.id, today),
        loadMedicationDosesBetween(profile.id, from, today),
        loadModuleNotificationPrefs(profile.id),
      ])
      setMedications(meds)
      setPeriods(pers)
      setSchedules(scheds)
      setDoses(dayDoses)
      setWeekDoses(rangeDoses)
      const medPref = prefs.find((row) => row.module === 'medicamentos')
      if (!pushIsConfigured()) setPushHint(null)
      else if (isIosWithoutPwa()) setPushHint('ios')
      else if (typeof Notification !== 'undefined' && Notification.permission === 'denied') setPushHint('blocked')
      else if (medPref && !medPref.enabled) setPushHint('off')
      else if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') setPushHint('off')
      else setPushHint(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pude traer tus tomas.')
    } finally {
      setLoading(false)
    }
  }, [profile, today])

  useEffect(() => {
    void reload()
  }, [reload])

  const slots = useMemo(
    () => dosesForDay(medications, periods, schedules, doses, today),
    [medications, periods, schedules, doses, today],
  )
  const summary = useMemo(() => summarizeDay(slots, new Date(), today), [slots, today])
  const hours = useMemo(() => groupByHour(slots), [slots])
  const week = useMemo(
    () => weekSummaries(medications, periods, schedules, weekDoses, today, 7),
    [medications, periods, schedules, weekDoses, today],
  )
  const firstDay = firstEligibleDay(periods)

  async function mark(slot: DayDoseSlot, status: 'taken' | 'skipped') {
    if (!profile) return
    const previous = doses.find(
      (dose) =>
        dose.medicationId === slot.medicationId &&
        dose.doseOn === today &&
        dose.scheduledTime === slot.scheduledTime,
    )
    try {
      const saved = await setMedicationDose({
        userId: profile.id,
        medicationId: slot.medicationId,
        doseOn: today,
        scheduledTime: slot.scheduledTime,
        status,
        nameSnapshot: slot.name,
        doseSnapshot: slot.doseNotes,
      })
      setDoses((current) => {
        const rest = current.filter(
          (dose) =>
            !(
              dose.medicationId === slot.medicationId &&
              dose.doseOn === today &&
              dose.scheduledTime === slot.scheduledTime
            ),
        )
        return [...rest, saved]
      })
      setTakeSlot(null)
      setToast({
        text: `Marcaste ${slot.name} de las ${formatHourLabel(slot.scheduledTime)} como ${status === 'taken' ? 'tomada' : 'salteada'}.`,
        undo: () => {
          void (async () => {
            if (previous) {
              await setMedicationDose({
                userId: profile.id,
                medicationId: previous.medicationId,
                doseOn: previous.doseOn,
                scheduledTime: previous.scheduledTime,
                status: previous.status,
                nameSnapshot: previous.nameSnapshot,
                doseSnapshot: previous.doseSnapshot,
              })
            } else {
              await clearMedicationDose({
                userId: profile.id,
                medicationId: slot.medicationId,
                doseOn: today,
                scheduledTime: slot.scheduledTime,
              })
            }
            await reload()
          })()
        },
      })
    } catch {
      setToast({ text: 'No pude guardar la toma. Probá de nuevo.' })
      await reload()
    }
  }

  async function unmark(slot: DayDoseSlot) {
    if (!profile) return
    try {
      await clearMedicationDose({
        userId: profile.id,
        medicationId: slot.medicationId,
        doseOn: today,
        scheduledTime: slot.scheduledTime,
      })
      setTakeSlot(null)
      await reload()
    } catch {
      setToast({ text: 'No pude guardar la toma. Probá de nuevo.' })
    }
  }

  const highlight = params.get('toma')

  return (
    <>
      <SectionHeader
        lead="crumb"
        module="medicamentos"
        aside={
          <span className="inline-flex items-center gap-1 rounded-2xl bg-ciruela-claro px-3 py-1.5 text-sm font-semibold text-tinta">
            <AppIcon name="lock" /> Solo vos
          </span>
        }
      />

      <div className="mb-3">
        <h1 className="font-display text-[2.125rem] font-semibold leading-none">Hoy</h1>
        <p className="mt-1 text-sm font-semibold capitalize text-muted">{formatLongDate(today)}</p>
      </div>

      {pushHint ? (
        <div className="mb-3 rounded-2xl border-2 border-azul-ink bg-card p-3">
          <p className="text-sm font-semibold">
            {pushHint === 'ios'
              ? 'En iPhone, los avisos necesitan la app en la pantalla de inicio.'
              : pushHint === 'blocked'
                ? 'Los avisos están bloqueados en el navegador.'
                : 'Los avisos están apagados en este celu.'}
          </p>
          <Link
            to="/notificaciones?desde=medicamentos"
            className="mt-1 inline-flex min-h-11 items-center font-semibold text-mostaza-ink"
          >
            {pushHint === 'ios' ? 'Ver cómo ›' : pushHint === 'blocked' ? 'Ver cómo activarlos ›' : 'Activar avisos ›'}
          </Link>
        </div>
      ) : null}

      {loading ? <p className="py-6 text-center font-semibold text-muted">Cargando tus tomas…</p> : null}

      {!loading && error ? (
        <div className="rounded-2xl border-2 border-azul-ink bg-card p-4 text-center">
          <p className="font-semibold" role="alert">
            <AppIcon name="circle-exclamation" className="mr-1" />
            No pude traer tus tomas. Revisá la conexión.
          </p>
          <Button className="mt-3" variant="alt" onClick={() => void reload()}>
            Reintentar
          </Button>
        </div>
      ) : null}

      {!loading && !error && medications.length === 0 ? (
        <div className="rounded-2xl border-2 border-azul-ink bg-card p-6 text-center">
          <div className="mb-3 flex justify-center">
            <Sprout module="medicamentos" />
          </div>
          <p className="font-semibold">Todavía no cargaste medicamentos.</p>
          <p className="mt-1 text-sm font-semibold text-muted">Sumá el primero con sus horas y te avisamos a la hora.</p>
          <Button className="mt-4" onClick={() => navigate('/medicamentos/agregar')}>
            Agregar un medicamento
          </Button>
        </div>
      ) : null}

      {!loading && !error && medications.length > 0 && slots.length === 0 ? (
        <div className="rounded-2xl border-2 border-azul-ink bg-card p-4 text-center">
          <p className="font-display text-[2.125rem] font-semibold leading-none">0 tomas de hoy</p>
          <p className="mt-2 font-semibold">Hoy no tenés ninguna toma.</p>
          <p className="mt-1 text-sm font-semibold text-muted">
            Tus tratamientos terminaron o empiezan más adelante.
          </p>
          <Link to="/medicamentos/tratamientos" className="mt-3 inline-flex min-h-11 items-center font-semibold text-mostaza-ink">
            Tus tratamientos
          </Link>
        </div>
      ) : null}

      {!loading && !error && slots.length > 0 ? (
        <>
          <section className="mb-3 rounded-2xl border-2 border-azul-ink bg-card p-4">
            <p className="font-display text-[2.125rem] font-semibold leading-none">
              {summary.taken} de {summary.total}{' '}
              <span className="font-display text-lg font-semibold">tomas de hoy</span>
            </p>
            <div className="mt-2 flex gap-1">
              {slots.map((slot, index) => (
                <i
                  key={`${slot.medicationId}-${slot.scheduledTime}-${index}`}
                  className={`h-2.5 min-w-1 flex-1 rounded-full border border-tinta ${
                    slot.status === 'taken' ? 'bg-ciruela' : 'bg-sand'
                  }`}
                />
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-muted">
                {summary.overdueUnmarked > 0
                  ? hubLine(slots, summary)
                  : summary.nextTime
                    ? `La próxima, a las ${formatHourLabel(summary.nextTime)}.`
                    : summary.taken === summary.total
                      ? 'Listas.'
                      : null}
              </p>
              <button
                type="button"
                onClick={() => setHistoryOpen(true)}
                className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-mostaza-ink"
              >
                <AppIcon name="calendar-days" /> Últimos 7 días
              </button>
            </div>
          </section>

          {hours.map((group) => (
            <section key={group.time} className="mb-3 rounded-2xl border-2 border-azul-ink bg-card">
              <header className="flex min-h-11 items-center px-4">
                <h2 className="font-display text-xl font-semibold">{formatHourLabel(group.time)}</h2>
              </header>
              <ul>
                {group.items.map((slot) => {
                  const overdue =
                    slot.status === null &&
                    summary.overdueUnmarked > 0 &&
                    slot.scheduledTime < (summary.nextTime ?? '99:99:99')
                  const key = `${slot.medicationId}-${slot.scheduledTime}`
                  return (
                    <li
                      key={key}
                      className={`flex min-h-[62px] items-center gap-3 border-t border-dashed border-azul-ink/40 px-4 py-2 ${
                        highlight === key ? 'bg-ciruela-claro/40' : ''
                      }`}
                    >
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setTakeSlot(slot)}>
                        <p className="text-lg font-semibold">{slot.name}</p>
                        <p className="text-sm font-semibold text-muted">
                          {[slot.doseNotes, slot.endsOn ? `hasta el ${slot.endsOn}` : null].filter(Boolean).join(' · ')}
                        </p>
                        {slot.status === 'taken' ? (
                          <p className="text-sm font-semibold text-muted">
                            <AppIcon name="check" className="mr-1" />
                            Tomada
                            {slot.recordedAt ? ` a las ${formatRecorded(slot.recordedAt)}.` : '.'}
                          </p>
                        ) : null}
                        {slot.status === 'skipped' ? (
                          <p className="text-sm font-semibold text-muted">Salteada.</p>
                        ) : null}
                        {slot.status === null && overdue ? (
                          <p className="text-sm font-bold text-tinta">
                            <AppIcon name="clock-rotate-left" className="mr-1" />
                            Era a las {formatHourLabel(slot.scheduledTime)}. Sin marcar.
                          </p>
                        ) : null}
                      </button>
                      <button
                        type="button"
                        aria-label={slot.status === 'taken' ? 'Desmarcar' : 'Marcar tomada'}
                        onClick={() => void (slot.status === 'taken' ? unmark(slot) : mark(slot, 'taken'))}
                        className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-tinta ${
                          slot.status === 'taken'
                            ? 'bg-tinta text-card'
                            : slot.status === 'skipped'
                              ? 'border-dashed bg-card text-muted'
                              : 'bg-card'
                        }`}
                      >
                        {slot.status === 'taken' ? <AppIcon name="check" /> : null}
                        {slot.status === 'skipped' ? <AppIcon name="arrow-right" /> : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}

          <Link
            to="/medicamentos/tratamientos"
            className="mb-3 flex min-h-14 items-center gap-3 rounded-2xl border-2 border-azul-ink bg-card px-4 font-semibold"
          >
            <AppIcon name="pills" />
            <span className="flex-1">Tus tratamientos</span>
            <AppIcon name="chevron-right" className="text-muted" />
          </Link>
        </>
      ) : null}

      <FabSpace avisos={Boolean(toast)} />
      <Fab to="/medicamentos/agregar" label="Agregar medicamento" />
      {toast ? (
        <Toast aboveFab onUndo={toast.undo} onDone={() => setToast(null)}>
          {toast.text}
        </Toast>
      ) : null}

      <Sheet open={historyOpen} title="Últimos 7 días" onClose={() => setHistoryOpen(false)}>
        <p className="mb-3 text-sm font-semibold text-muted">Tocá un día para ver y marcar sus tomas.</p>
        <ul>
          {week.map((row) => (
            <li key={row.iso}>
              <button
                type="button"
                className="mb-2 flex w-full min-h-14 items-center gap-3 rounded-2xl border-2 border-azul-ink bg-card px-3 py-2 text-left"
                onClick={() => {
                  setHistoryOpen(false)
                  if (row.iso === today) return
                  navigate(`/medicamentos/dia/${row.iso}`)
                }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{row.iso === today ? 'Hoy' : formatLongDate(row.iso)}</span>
                  <span className="block text-sm font-semibold text-muted">
                    {row.skipped ? `${row.skipped} salteada${row.skipped > 1 ? 's' : ''}.` : null}
                    {row.unmarked ? ` ${row.unmarked} sin marcar.` : null}
                  </span>
                </span>
                <span className="font-display text-lg font-semibold">
                  {row.taken} de {row.total}
                </span>
                <AppIcon name="chevron-right" className="text-muted" />
              </button>
            </li>
          ))}
        </ul>
        {firstDay ? (
          <label className="mt-2 flex min-h-11 cursor-pointer items-center justify-center gap-2 font-semibold text-mostaza-ink">
            <AppIcon name="calendar-days" />
            Elegir otro día
            <input
              type="date"
              className="sr-only"
              min={firstDay}
              max={shiftArgentinaISO(today, -1)}
              onChange={(event) => {
                const value = event.target.value
                if (!value) return
                setHistoryOpen(false)
                navigate(`/medicamentos/dia/${value}`)
              }}
            />
          </label>
        ) : null}
      </Sheet>

      <Sheet
        open={Boolean(takeSlot)}
        title={takeSlot ? takeSlot.name : 'Toma'}
        onClose={() => setTakeSlot(null)}
        footer={
          takeSlot ? (
            <div className="space-y-2">
              {takeSlot.status !== 'taken' ? (
                <Button tall onClick={() => void mark(takeSlot, 'taken')}>
                  La tomé
                </Button>
              ) : (
                <Button tall variant="alt" onClick={() => void unmark(takeSlot)}>
                  Desmarcar
                </Button>
              )}
              {takeSlot.status !== 'skipped' ? (
                <Button tall variant="alt" onClick={() => void mark(takeSlot, 'skipped')}>
                  La salteé
                </Button>
              ) : null}
              <Button tall variant="alt" onClick={() => navigate(`/medicamentos/${takeSlot.medicationId}`)}>
                Editar el medicamento
              </Button>
            </div>
          ) : null
        }
      >
        {takeSlot ? (
          <p className="font-semibold text-muted">
            {takeSlot.doseNotes ? `${takeSlot.doseNotes}. ` : null}
            Programada a las {formatHourLabel(takeSlot.scheduledTime)}.
            {takeSlot.recordedAt ? ` La marcaste a las ${formatRecorded(takeSlot.recordedAt)}.` : null}
          </p>
        ) : null}
      </Sheet>
    </>
  )
}

function hubLine(slots: DayDoseSlot[], summary: ReturnType<typeof summarizeDay>): string {
  if (summary.overdueUnmarked === 1) {
    const overdue = slots.find((slot) => slot.status === null)
    return overdue ? `Una sin marcar, de las ${formatHourLabel(overdue.scheduledTime)}.` : 'Una sin marcar.'
  }
  return `${summary.overdueUnmarked} sin marcar.`
}

function formatRecorded(iso: string): string {
  const parts = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso))
  const h = parts.find((part) => part.type === 'hour')?.value ?? '0'
  const m = parts.find((part) => part.type === 'minute')?.value ?? '00'
  return `${Number(h)}:${m}`
}
