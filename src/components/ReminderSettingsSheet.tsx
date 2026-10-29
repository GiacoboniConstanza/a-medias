import { useId, useState } from 'react'
import { AppIcon } from './AppIcon.tsx'
import { Sheet } from './Sheet.tsx'
import { ErrorText, Toggle } from './ui.tsx'
import { MAX_ASK_TIMES, nextTimeSlot, reminderFootnote, timesValid, type ReminderPrefs } from '../lib/reminders.ts'

const pill =
  'min-h-11 rounded-[18px] border-2 border-sage-light bg-white px-3.5 font-display text-xl font-bold text-primary scheme-light'

export function ReminderSettingsSheet({
  open,
  prefs,
  partnerName,
  error,
  onClose,
  onChange,
  onActivatePush,
}: {
  open: boolean
  prefs: ReminderPrefs
  partnerName: string
  error: string
  onClose: () => void
  onChange: (next: ReminderPrefs) => void
  onActivatePush: () => void
}) {
  const dailyId = useId()
  const sharedId = useId()
  const sundayId = useId()
  const extra = nextTimeSlot(prefs.times)
  const [hint, setHint] = useState('')

  function updateTime(index: number, value: string) {
    const next = prefs.times.map((time, item) => (item === index ? value : time))
    if (!timesValid(next)) {
      setHint('Elegí horarios distintos.')
      return
    }
    setHint('')
    onChange({ ...prefs, times: next })
  }

  function removeTime(index: number) {
    const next = prefs.times.filter((_, item) => item !== index)
    if (!timesValid(next)) return
    onChange({ ...prefs, times: next })
  }

  function addTime() {
    if (!extra) return
    onChange({ ...prefs, times: [...prefs.times, extra] })
  }

  function shiftLead(delta: number) {
    onChange({ ...prefs, dueLeadDays: Math.min(28, Math.max(0, prefs.dueLeadDays + delta)) })
  }

  return (
    <Sheet open={open} title="Mis recordatorios" onClose={onClose}>
      <section className="mb-3 rounded-3xl bg-sand px-4 py-4">
        <p className="text-base font-bold text-text">Activar notificaciones en el celu</p>
        <p className="mt-1 text-sm font-semibold text-muted">Si el celular no está configurado, no enviamos nada.</p>
        <button
          type="button"
          className="mt-3 min-h-11 rounded-2xl bg-primary px-4 text-sm font-bold text-white disabled:opacity-50"
          onClick={onActivatePush}
          disabled={prefs.pushEnabled}
        >
          {prefs.pushEnabled ? 'Activadas' : 'Activar'}
        </button>
      </section>

      <section className="mb-4">
        <div className="flex items-center justify-between gap-3">
          <p id={dailyId} className="text-base font-bold text-text">
            ¿Gastaste algo hoy?
          </p>
          <Toggle labelledBy={dailyId} checked={prefs.enabled} onClick={() => onChange({ ...prefs, enabled: !prefs.enabled })} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {prefs.times.map((time, index) => (
            <span key={index} className="inline-flex items-center gap-1">
              <input
                type="time"
                aria-label={`Horario ${index + 1}`}
                value={time}
                onChange={(event) => updateTime(index, event.target.value)}
                className={pill}
              />
              {prefs.times.length > 1 ? (
                <button
                  type="button"
                  aria-label={`Quitar ${time}`}
                  className="grid h-11 w-11 place-items-center text-muted"
                  onClick={() => removeTime(index)}
                >
                  <AppIcon name="xmark" />
                </button>
              ) : null}
            </span>
          ))}
          {extra ? (
            <button
              type="button"
              className="min-h-11 rounded-[18px] border-2 border-dashed border-sage-light bg-white px-3.5 text-sm font-bold text-muted"
              onClick={addTime}
            >
              + Hora
            </button>
          ) : null}
        </div>
        {prefs.times.length >= MAX_ASK_TIMES ? <p className="mt-2 text-xs font-semibold text-muted">Hasta cuatro horarios.</p> : null}
      </section>

      <section className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-base font-bold text-text">Vencimientos</p>
          <p className="text-sm font-semibold text-muted">{leadCopy(prefs.dueLeadDays)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-2xl bg-sand font-display text-xl font-semibold text-text"
            aria-label="Menos días antes"
            onClick={() => shiftLead(-1)}
          >
            −
          </button>
          <span className="min-w-8 text-center font-display text-xl font-bold text-text">{prefs.dueLeadDays}</span>
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-2xl bg-sand font-display text-xl font-semibold text-text"
            aria-label="Más días antes"
            onClick={() => shiftLead(1)}
          >
            +
          </button>
        </div>
      </section>

      <section className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p id={sharedId} className="text-base font-bold text-text">
            Cuando {partnerName} carga un gasto compartido
          </p>
          <p className="text-sm font-semibold text-muted">Nunca ves sus gastos privados.</p>
        </div>
        <Toggle
          labelledBy={sharedId}
          checked={prefs.notifyShared}
          onClick={() => onChange({ ...prefs, notifyShared: !prefs.notifyShared })}
        />
      </section>

      <section className="mb-2 flex items-center justify-between gap-3">
        <p id={sundayId} className="text-base font-bold text-text">
          Resumen del domingo
        </p>
        <Toggle
          labelledBy={sundayId}
          checked={prefs.sundaySummary}
          onClick={() => onChange({ ...prefs, sundaySummary: !prefs.sundaySummary })}
        />
      </section>
      <p className="mt-4 text-xs font-semibold text-muted">{reminderFootnote(prefs)}</p>
      <ErrorText>{hint || error}</ErrorText>
    </Sheet>
  )
}

function leadCopy(days: number): string {
  if (days === 0) return 'El mismo día'
  if (days === 1) return '1 día antes'
  return `${days} días antes`
}
