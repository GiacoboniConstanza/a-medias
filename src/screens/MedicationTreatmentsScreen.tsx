import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { AppIcon } from '../components/AppIcon.tsx'
import { Toast } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import {
  loadMedicationPeriods,
  loadMedications,
  loadMedicationSchedules,
  type MedicationPeriodRow,
  type MedicationRow,
  type MedicationScheduleRow,
} from '../lib/api.ts'
import { formatHourLabel, groupTreatments, latestPeriod } from '../lib/medications.ts'
import { pushIsConfigured } from '../lib/push/permissions.ts'

function formatArchiveLine(med: MedicationRow, period: MedicationPeriodRow | null): string {
  if (med.archivedAt) {
    const day = new Intl.DateTimeFormat('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date(med.archivedAt))
    return `Archivado el ${day}`
  }
  if (period?.endsOn) {
    const [y, m, d] = period.endsOn.split('-').map(Number)
    const day = new Intl.DateTimeFormat('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(y, m - 1, d)))
    return `Terminó el ${day}`
  }
  return 'Archivado'
}

export function MedicationTreatmentsScreen() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [medications, setMedications] = useState<MedicationRow[]>([])
  const [periods, setPeriods] = useState<MedicationPeriodRow[]>([])
  const [schedules, setSchedules] = useState<MedicationScheduleRow[]>([])
  const [toast, setToast] = useState<string | null>(
    (location.state as { toast?: string } | null)?.toast ?? null,
  )
  const [pushLabel, setPushLabel] = useState('Avisos en este celu')

  useEffect(() => {
    if (!profile) return
    let active = true
    setLoading(true)
    Promise.all([loadMedications(profile.id), loadMedicationPeriods(profile.id), loadMedicationSchedules(profile.id)])
      .then(([meds, pers, scheds]) => {
        if (!active) return
        setMedications(meds)
        setPeriods(pers)
        setSchedules(scheds)
        setError('')
        setLoading(false)
      })
      .catch((caught: unknown) => {
        if (!active) return
        setError(caught instanceof Error ? caught.message : 'No pude traer tus tratamientos.')
        setLoading(false)
      })
    if (!pushIsConfigured()) setPushLabel('Avisos en este celu: todavía no')
    else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      setPushLabel('Avisos en este celu: activados')
    } else setPushLabel('Avisos en este celu: apagados')
    return () => {
      active = false
    }
  }, [profile])

  const groups = useMemo(() => groupTreatments(medications, periods), [medications, periods])

  function timesLabel(medicationId: string): string {
    return schedules
      .filter((row) => row.medicationId === medicationId)
      .map((row) => formatHourLabel(row.localTime))
      .join(', ')
  }

  function courseLine(med: MedicationRow): string {
    const period = latestPeriod(periods, med.id)
    const bits = [
      med.doseNotes,
      timesLabel(med.id) || null,
      period?.endsOn ? `Hasta el ${period.endsOn}` : 'Sin fecha de fin',
    ].filter(Boolean)
    return bits.join(' · ')
  }

  function upcomingLine(med: MedicationRow): string {
    const period = latestPeriod(periods, med.id)
    return [med.doseNotes, timesLabel(med.id), period ? `Desde el ${period.startsOn}` : null]
      .filter(Boolean)
      .join(' · ')
  }

  return (
    <>
      <header className="mb-4 flex min-h-11 items-center gap-3">
        <Link to="/medicamentos" aria-label="Volver" className="grid h-11 w-11 place-items-center rounded-full bg-card shadow-soft">
          <AppIcon name="chevron-left" />
        </Link>
        <h1 className="font-display text-[1.8rem] font-semibold">Tratamientos</h1>
      </header>

      {loading ? <p className="py-6 text-center font-semibold text-muted">Cargando tus tratamientos…</p> : null}
      {!loading && error ? (
        <div className="rounded-2xl border-2 border-azul-ink bg-card p-4 text-center">
          <p className="font-semibold" role="alert">
            {error}
          </p>
          <button type="button" className="mt-3 font-semibold text-mostaza-ink" onClick={() => navigate(0)}>
            Reintentar
          </button>
        </div>
      ) : null}

      {!loading && !error && medications.length === 0 ? (
        <p className="py-6 text-center font-semibold text-muted">Todavía no cargaste medicamentos.</p>
      ) : null}

      {!loading && !error ? (
        <div className="space-y-3 pb-8">
          {groups.inCourse.length > 0 ? (
            <section>
              <h2 className="mb-2 font-display text-lg font-semibold">En curso</h2>
              <ul className="rounded-2xl border-2 border-azul-ink bg-card">
                {groups.inCourse.map((med, index) => (
                  <li key={med.id} className={index > 0 ? 'border-t border-dashed border-azul-ink/40' : ''}>
                    <Link to={`/medicamentos/${med.id}`} className="flex min-h-14 items-center gap-3 px-4 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{med.name}</span>
                        <span className="block text-sm font-semibold text-muted">{courseLine(med)}</span>
                      </span>
                      <AppIcon name="chevron-right" className="text-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {groups.upcoming.length > 0 ? (
            <section>
              <h2 className="mb-2 font-display text-lg font-semibold">Empieza más adelante</h2>
              <ul className="rounded-2xl border-2 border-azul-ink bg-card">
                {groups.upcoming.map((med, index) => (
                  <li key={med.id} className={index > 0 ? 'border-t border-dashed border-azul-ink/40' : ''}>
                    <Link to={`/medicamentos/${med.id}`} className="flex min-h-14 items-center gap-3 px-4 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{med.name}</span>
                        <span className="block text-sm font-semibold text-muted">{upcomingLine(med)}</span>
                      </span>
                      <AppIcon name="chevron-right" className="text-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {groups.archived.length > 0 ? (
            <section>
              <h2 className="mb-2 font-display text-lg font-semibold text-muted">Archivados</h2>
              <ul className="rounded-2xl border-2 border-azul-ink bg-card">
                {groups.archived.map((med, index) => {
                  const period = latestPeriod(periods, med.id)
                  return (
                    <li key={med.id} className={index > 0 ? 'border-t border-dashed border-azul-ink/40' : ''}>
                      <Link to={`/medicamentos/${med.id}`} className="flex min-h-14 items-center gap-3 px-4 py-3">
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">{med.name}</span>
                          <span className="block text-sm font-semibold text-muted">
                            {[med.doseNotes, formatArchiveLine(med, period)].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                        <AppIcon name="chevron-right" className="text-muted" />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : null}

          <Link
            to="/notificaciones?desde=medicamentos"
            className="flex min-h-14 items-center gap-3 rounded-2xl border-2 border-azul-ink bg-card px-4 font-semibold"
          >
            <AppIcon name="bell" />
            <span className="flex-1">{pushLabel}</span>
            <AppIcon name="chevron-right" className="text-muted" />
          </Link>
        </div>
      ) : null}

      {toast ? (
        <Toast onDone={() => setToast(null)}>
          {toast}
        </Toast>
      ) : null}
    </>
  )
}
