import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { AppIcon } from '../components/AppIcon.tsx'
import { Sheet } from '../components/Sheet.tsx'
import { Button, Toast } from '../components/ui.tsx'
// Button + Toast
import { useAuth } from '../context/AuthProvider.tsx'
import {
  clearMedicationDose,
  loadMedicationDosesForDay,
  loadMedicationPeriods,
  loadMedications,
  loadMedicationSchedules,
  setMedicationDose,
  type MedicationDoseRow,
  type MedicationPeriodRow,
  type MedicationRow,
  type MedicationScheduleRow,
} from '../lib/api.ts'
import { argentinaISO } from '../lib/meals.ts'
import { dosesForDay, formatHourLabel, summarizeDay, type DayDoseSlot } from '../lib/medications.ts'

function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const label = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function MedicationDayScreen() {
  const { fecha } = useParams()
  const day = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : argentinaISO()
  const today = argentinaISO()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [medications, setMedications] = useState<MedicationRow[]>([])
  const [periods, setPeriods] = useState<MedicationPeriodRow[]>([])
  const [schedules, setSchedules] = useState<MedicationScheduleRow[]>([])
  const [doses, setDoses] = useState<MedicationDoseRow[]>([])
  const [takeSlot, setTakeSlot] = useState<DayDoseSlot | null>(null)
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null)

  const reload = useCallback(async () => {
    if (!profile) return
    if (day >= today) {
      navigate('/medicamentos', { replace: true })
      return
    }
    setLoading(true)
    try {
      const [meds, pers, scheds, dayDoses] = await Promise.all([
        loadMedications(profile.id),
        loadMedicationPeriods(profile.id),
        loadMedicationSchedules(profile.id),
        loadMedicationDosesForDay(profile.id, day),
      ])
      setMedications(meds)
      setPeriods(pers)
      setSchedules(scheds)
      setDoses(dayDoses)
      setError('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pude traer ese día.')
    } finally {
      setLoading(false)
    }
  }, [profile, day, today, navigate])

  useEffect(() => {
    void reload()
  }, [reload])

  const slots = useMemo(
    () => dosesForDay(medications, periods, schedules, doses, day),
    [medications, periods, schedules, doses, day],
  )
  const summary = useMemo(() => summarizeDay(slots, new Date(), day), [slots, day])
  const hours = useMemo(() => {
    const map = new Map<string, DayDoseSlot[]>()
    for (const slot of slots) {
      const list = map.get(slot.scheduledTime) ?? []
      list.push(slot)
      map.set(slot.scheduledTime, list)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [slots])

  async function mark(slot: DayDoseSlot, status: 'taken' | 'skipped') {
    if (!profile) return
    try {
      const saved = await setMedicationDose({
        userId: profile.id,
        medicationId: slot.medicationId,
        doseOn: day,
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
              dose.doseOn === day &&
              dose.scheduledTime === slot.scheduledTime
            ),
        )
        return [...rest, saved]
      })
      setTakeSlot(null)
      setToast({
        text: `Marcaste ${slot.name} de las ${formatHourLabel(slot.scheduledTime)} del ${formatLongDate(day).toLowerCase()} como ${status === 'taken' ? 'tomada' : 'salteada'}.`,
        undo: () => {
          void clearMedicationDose({
            userId: profile.id,
            medicationId: slot.medicationId,
            doseOn: day,
            scheduledTime: slot.scheduledTime,
          }).then(() => reload())
        },
      })
    } catch {
      setToast({ text: 'No pude guardar la toma. Probá de nuevo.' })
    }
  }

  return (
    <>
      <header className="mb-4 flex min-h-11 items-center gap-3">
        <Link to="/medicamentos" aria-label="Volver" className="grid h-11 w-11 place-items-center rounded-full bg-card shadow-soft">
          <AppIcon name="chevron-left" />
        </Link>
        <h1 className="font-display text-[1.8rem] font-semibold">{formatLongDate(day)}</h1>
      </header>

      {loading ? <p className="py-6 text-center font-semibold text-muted">Cargando…</p> : null}
      {!loading && error ? (
        <div className="rounded-2xl border-2 border-azul-ink bg-card p-4 text-center">
          <p className="font-semibold" role="alert">
            No pude traer ese día.
          </p>
          <Button className="mt-3" variant="alt" onClick={() => void reload()}>
            Reintentar
          </Button>
        </div>
      ) : null}

      {!loading && !error && slots.length === 0 ? (
        <p className="py-6 text-center font-semibold text-muted">Ese día no había tomas.</p>
      ) : null}

      {!loading && !error && slots.length > 0 ? (
        <>
          <section className="mb-3 rounded-2xl border-2 border-azul-ink bg-card p-4">
            <p className="font-display text-[2.125rem] font-semibold leading-none">
              {summary.taken} de {summary.total}{' '}
              <span className="font-display text-lg font-semibold">tomas de ese día</span>
            </p>
            <p className="mt-2 text-sm font-semibold text-muted">Podés marcar lo que te faltó anotar.</p>
          </section>
          {hours.map(([time, items]) => (
            <section key={time} className="mb-3 rounded-2xl border-2 border-azul-ink bg-card">
              <header className="flex min-h-11 items-center px-4">
                <h2 className="font-display text-xl font-semibold">{formatHourLabel(time)}</h2>
              </header>
              <ul>
                {items.map((slot) => (
                  <li
                    key={`${slot.medicationId}-${slot.scheduledTime}`}
                    className="flex min-h-[62px] items-center gap-3 border-t border-dashed border-azul-ink/40 px-4 py-2"
                  >
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setTakeSlot(slot)}>
                      <p className="text-lg font-semibold">{slot.name}</p>
                      <p className="text-sm font-semibold text-muted">{slot.doseNotes}</p>
                      {slot.status === 'taken' ? <p className="text-sm font-semibold text-muted">Tomada.</p> : null}
                      {slot.status === 'skipped' ? <p className="text-sm font-semibold text-muted">Salteada.</p> : null}
                      {slot.status === null ? (
                        <p className="text-sm font-bold text-tinta">Era a las {formatHourLabel(slot.scheduledTime)}. Sin marcar.</p>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      aria-label="Marcar tomada"
                      className={`grid h-11 w-11 place-items-center rounded-full border-2 border-tinta ${
                        slot.status === 'taken' ? 'bg-tinta text-card' : 'bg-card'
                      }`}
                      onClick={() => void (slot.status === 'taken' ? clearMedicationDose({
                        userId: profile!.id,
                        medicationId: slot.medicationId,
                        doseOn: day,
                        scheduledTime: slot.scheduledTime,
                      }).then(() => reload()) : mark(slot, 'taken'))}
                    >
                      {slot.status === 'taken' ? <AppIcon name="check" /> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      ) : null}

      {toast ? (
        <Toast aboveFab onUndo={toast.undo} onDone={() => setToast(null)}>
          {toast.text}
        </Toast>
      ) : null}

      <Sheet
        open={Boolean(takeSlot)}
        title={takeSlot?.name ?? 'Toma'}
        onClose={() => setTakeSlot(null)}
        footer={
          takeSlot ? (
            <div className="space-y-2">
              <Button tall onClick={() => void mark(takeSlot, 'taken')}>
                La tomé
              </Button>
              <Button tall variant="alt" onClick={() => void mark(takeSlot, 'skipped')}>
                La salteé
              </Button>
              {takeSlot.status ? (
                <Button
                  tall
                  variant="alt"
                  onClick={() =>
                    void clearMedicationDose({
                      userId: profile!.id,
                      medicationId: takeSlot.medicationId,
                      doseOn: day,
                      scheduledTime: takeSlot.scheduledTime,
                    }).then(() => {
                      setTakeSlot(null)
                      return reload()
                    })
                  }
                >
                  Desmarcar
                </Button>
              ) : null}
            </div>
          ) : null
        }
      >
        {takeSlot ? <p className="font-semibold text-muted">Programada a las {formatHourLabel(takeSlot.scheduledTime)}.</p> : null}
      </Sheet>
    </>
  )
}
