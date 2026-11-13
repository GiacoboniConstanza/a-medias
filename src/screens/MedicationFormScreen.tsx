import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { AppIcon } from '../components/AppIcon.tsx'
import { ConfirmSheet } from '../components/ConfirmSheet.tsx'
import { Button } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import {
  archiveMedication,
  createMedication,
  loadMedicationPeriods,
  loadMedications,
  loadMedicationSchedules,
  reactivateMedication,
  updateMedication,
} from '../lib/api.ts'
import { argentinaISO } from '../lib/meals.ts'
import { currentPeriod, formatHourLabel, latestPeriod, maxSchedules } from '../lib/medications.ts'

function nextHourOnTheHour(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0')
  const next = (hour + 1) % 24
  return `${String(next).padStart(2, '0')}:00`
}

export function MedicationFormScreen() {
  const { id } = useParams()
  const editing = Boolean(id)
  const { profile } = useAuth()
  const navigate = useNavigate()
  const today = argentinaISO()

  const [loading, setLoading] = useState(editing)
  const [name, setName] = useState('')
  const [doseNotes, setDoseNotes] = useState('')
  const [times, setTimes] = useState<string[]>([nextHourOnTheHour()])
  const [startsOn, setStartsOn] = useState(today)
  const [hasEnd, setHasEnd] = useState(false)
  const [endsOn, setEndsOn] = useState('')
  const [archived, setArchived] = useState(false)
  const [periodId, setPeriodId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [archiveBusy, setArchiveBusy] = useState(false)
  const [archiveError, setArchiveError] = useState('')

  useEffect(() => {
    if (!profile || !id) return
    let active = true
    setLoading(true)
    Promise.all([loadMedications(profile.id), loadMedicationPeriods(profile.id), loadMedicationSchedules(profile.id)])
      .then(([meds, periods, schedules]) => {
        if (!active) return
        const med = meds.find((row) => row.id === id)
        if (!med) {
          setSaveError('No encontré ese medicamento.')
          setLoading(false)
          return
        }
        setName(med.name)
        setDoseNotes(med.doseNotes ?? '')
        setArchived(Boolean(med.archivedAt))
        const open = currentPeriod(periods, med.id) ?? latestPeriod(periods, med.id)
        setPeriodId(open?.id ?? null)
        if (med.archivedAt) {
          // M30: al volver a usar, Desde = hoy y Sin fecha de fin preseleccionada.
          setStartsOn(today)
          setHasEnd(false)
          setEndsOn('')
        } else {
          setStartsOn(open?.startsOn ?? today)
          setHasEnd(Boolean(open?.endsOn))
          setEndsOn(open?.endsOn ?? '')
        }
        const medTimes = schedules
          .filter((row) => row.medicationId === med.id)
          .map((row) => row.localTime.slice(0, 5))
          .sort()
        setTimes(medTimes.length > 0 ? medTimes : [nextHourOnTheHour()])
        setLoading(false)
      })
      .catch((caught: unknown) => {
        if (!active) return
        setSaveError(caught instanceof Error ? caught.message : 'No pude cargar.')
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [profile, id, today])

  const sortedTimes = useMemo(() => [...times].sort(), [times])

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = 'Poné el nombre.'
    if (sortedTimes.length === 0) next.times = 'Sumá al menos una hora.'
    if (new Set(sortedTimes).size !== sortedTimes.length) next.times = 'Elegí horas distintas.'
    if (hasEnd && endsOn && endsOn < startsOn) next.endsOn = 'La fecha no puede ser anterior a Desde.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function onSave() {
    if (!profile || archived) return
    if (!validate()) return
    setBusy(true)
    setSaveError('')
    try {
      const payloadTimes = sortedTimes.map((time) => `${time}:00`)
      if (editing && id && periodId) {
        await updateMedication({
          id,
          userId: profile.id,
          name: name.trim(),
          doseNotes: doseNotes.trim() || null,
          times: payloadTimes,
          endsOn: hasEnd ? endsOn || null : null,
          periodId,
        })
        navigate('/medicamentos/tratamientos')
      } else {
        const created = await createMedication({
          userId: profile.id,
          name: name.trim(),
          doseNotes: doseNotes.trim() || null,
          startsOn,
          endsOn: hasEnd ? endsOn || null : null,
          times: payloadTimes,
        })
        navigate('/medicamentos', { state: { toast: `Sumaste ${created.name}.` } })
      }
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : 'No pude guardar. Revisá la conexión y probá de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  async function onReactivate() {
    if (!profile || !id) return
    if (!validate()) return
    setBusy(true)
    setSaveError('')
    try {
      await reactivateMedication({
        id,
        userId: profile.id,
        startsOn,
        endsOn: hasEnd ? endsOn || null : null,
      })
      const freshPeriods = await loadMedicationPeriods(profile.id)
      const fresh = currentPeriod(freshPeriods, id) ?? latestPeriod(freshPeriods, id)
      if (fresh) {
        await updateMedication({
          id,
          userId: profile.id,
          name: name.trim(),
          doseNotes: doseNotes.trim() || null,
          times: sortedTimes.map((time) => `${time}:00`),
          endsOn: hasEnd ? endsOn || null : null,
          periodId: fresh.id,
        })
      }
      navigate('/medicamentos/tratamientos', { state: { toast: `Volviste a usar el ${name.trim().toLowerCase()}.` } })
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : 'No pude guardar.')
    } finally {
      setBusy(false)
    }
  }

  async function onArchive() {
    if (!profile || !id || !periodId) return
    setArchiveBusy(true)
    setArchiveError('')
    try {
      await archiveMedication({ id, userId: profile.id, periodId })
      setArchiveOpen(false)
      navigate('/medicamentos/tratamientos', { state: { toast: `Archivé ${name}.` } })
    } catch (caught) {
      setArchiveError(caught instanceof Error ? caught.message : 'No pude archivarlo.')
    } finally {
      setArchiveBusy(false)
    }
  }

  return (
    <>
      <header className="mb-4 flex min-h-11 items-center gap-3">
        <Link to={editing ? '/medicamentos/tratamientos' : '/medicamentos'} aria-label="Volver" className="grid h-11 w-11 place-items-center rounded-full bg-card shadow-soft">
          <AppIcon name="chevron-left" />
        </Link>
        <h1 className="font-display text-[1.8rem] font-semibold">{editing ? 'Editar' : 'Agregar'}</h1>
      </header>

      {loading ? <p className="py-6 text-center font-semibold text-muted">Cargando…</p> : null}

      {!loading ? (
        <div className="space-y-4 pb-28">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Nombre</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Por ejemplo, Ibuprofeno"
              className="w-full rounded-2xl border-2 border-azul-ink bg-card px-3 py-3 font-semibold"
            />
            {errors.name ? <p className="mt-1 text-sm font-bold text-tinta">{errors.name}</p> : null}
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Dosis</span>
            <input
              value={doseNotes}
              onChange={(event) => setDoseNotes(event.target.value)}
              className="w-full rounded-2xl border-2 border-azul-ink bg-card px-3 py-3 font-semibold"
            />
            <p className="mt-1 text-sm font-semibold text-muted">Como figura en la caja o en la receta. Es opcional.</p>
          </label>

          <div>
            <span className="mb-1 block text-sm font-semibold">Horas</span>
            <div className="flex flex-wrap gap-2">
              {sortedTimes.map((time) => (
                <span key={time} className="inline-flex min-h-[52px] items-center gap-1 rounded-full border-2 border-azul-ink bg-card px-3 font-semibold">
                  <input
                    type="time"
                    value={time}
                    onChange={(event) =>
                      setTimes((current) => current.map((row) => (row === time ? event.target.value : row)))
                    }
                    className="bg-transparent font-semibold"
                  />
                  <button
                    type="button"
                    aria-label="Quitar hora"
                    className="grid h-11 w-11 place-items-center"
                    onClick={() => setTimes((current) => current.filter((row) => row !== time))}
                  >
                    <AppIcon name="xmark" />
                  </button>
                </span>
              ))}
            </div>
            {times.length < maxSchedules() ? (
              <button
                type="button"
                className="mt-2 inline-flex min-h-11 items-center font-semibold text-mostaza-ink"
                onClick={() => setTimes((current) => [...current, nextHourOnTheHour()])}
              >
                + Sumar otra hora
              </button>
            ) : (
              <p className="mt-2 text-sm font-semibold text-muted">Hasta seis horas.</p>
            )}
            <p className="mt-1 text-sm font-semibold text-muted">
              {archived
                ? 'Todos los días, a estas horas.'
                : 'Todos los días, a estas horas, te llega un aviso.'}
            </p>
            {errors.times ? <p className="mt-1 text-sm font-bold text-tinta">{errors.times}</p> : null}
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Desde</span>
            <input
              type="date"
              value={startsOn}
              disabled={editing && !archived}
              onChange={(event) => setStartsOn(event.target.value)}
              className="w-full rounded-2xl border-2 border-azul-ink bg-card px-3 py-3 font-semibold disabled:opacity-70"
            />
          </label>

          <div>
            <span className="mb-1 block text-sm font-semibold">Hasta</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`min-h-11 rounded-2xl border-2 px-3 font-semibold ${!hasEnd ? 'border-tinta bg-ciruela-claro' : 'border-azul-ink bg-card'}`}
                onClick={() => setHasEnd(false)}
              >
                Sin fecha de fin
              </button>
              <button
                type="button"
                className={`min-h-11 rounded-2xl border-2 px-3 font-semibold ${hasEnd ? 'border-tinta bg-ciruela-claro' : 'border-azul-ink bg-card'}`}
                onClick={() => setHasEnd(true)}
              >
                Hasta una fecha
              </button>
            </div>
            {hasEnd ? (
              <>
                <input
                  type="date"
                  value={endsOn}
                  min={startsOn}
                  onChange={(event) => setEndsOn(event.target.value)}
                  className="mt-2 w-full rounded-2xl border-2 border-azul-ink bg-card px-3 py-3 font-semibold"
                />
                <p className="mt-1 text-sm font-semibold text-muted">La última toma es ese día a la última hora.</p>
              </>
            ) : null}
            {errors.endsOn ? <p className="mt-1 text-sm font-bold text-tinta">{errors.endsOn}</p> : null}
          </div>

          {editing && !archived ? (
            <div className="border-t border-dashed border-azul-ink/50 pt-4">
              <Button variant="danger" tall className="w-full" onClick={() => setArchiveOpen(true)}>
                <AppIcon name="box-archive" className="mr-2" />
                Archivar medicamento
              </Button>
              <p className="mt-2 text-sm font-semibold text-muted">
                Deja de avisarte desde ahora y sale de Hoy. Lo que marcaste queda; lo ves en Tus tratamientos, en Archivados.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-azul-ink/20 bg-sand/95 px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-[var(--ancho-columna)]">
          {saveError ? (
            <p className="mb-2 text-center text-sm font-bold text-tinta" role="alert">
              {saveError}
            </p>
          ) : null}
          {archived ? (
            <Button tall className="w-full" disabled={busy} onClick={() => void onReactivate()}>
              {busy ? 'Guardando…' : 'Volver a usar'}
            </Button>
          ) : (
            <Button tall className="w-full" disabled={busy || loading} onClick={() => void onSave()}>
              {busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Guardar'}
            </Button>
          )}
        </div>
      </div>

      <ConfirmSheet
        open={archiveOpen}
        title={`¿Archivar ${name ? `la ${name.toLowerCase()}` : 'este medicamento'}?`}
        onClose={() => setArchiveOpen(false)}
        confirmLabel={archiveBusy ? 'Archivando…' : 'Archivar'}
        onConfirm={() => void onArchive()}
        busy={archiveBusy}
        error={archiveError}
      >
        <p className="font-semibold">
          Ya no te van a llegar avisos y sale de Hoy. Lo que marcaste queda en Últimos 7 días. La ves en Tus tratamientos, en Archivados.
        </p>
        {times.length > 0 ? (
          <p className="mt-2 text-sm font-semibold text-muted">
            Horas: {sortedTimes.map((time) => formatHourLabel(`${time}:00`)).join(', ')}.
          </p>
        ) : null}
      </ConfirmSheet>
    </>
  )
}
