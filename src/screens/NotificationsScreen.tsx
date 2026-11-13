import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { AppIcon } from '../components/AppIcon.tsx'
import { ModuleSwitch } from '../components/ModuleSwitch.tsx'
import { Button } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { loadModuleNotificationPrefs, setModuleNotificationPref } from '../lib/api.ts'
import {
  isIosWithoutPwa,
  pushIsConfigured,
  subscribeToPush,
  unsubscribeFromPush,
  type PushReadiness,
} from '../lib/push/permissions.ts'
import { supabase } from '../lib/supabase.ts'

type ScreenState =
  | 'loading'
  | 'prompt'
  | 'ready'
  | 'blocked'
  | 'unsupported'
  | 'ios'
  | 'not_configured'
  | 'error'

export function NotificationsScreen() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const backTo = params.get('desde') === 'medicamentos' ? '/medicamentos' : '/modulos'
  const [state, setState] = useState<ScreenState>('loading')
  const [medEnabled, setMedEnabled] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const refresh = useCallback(async () => {
    setState('loading')
    setMessage('')
    if (!pushIsConfigured()) {
      setState('not_configured')
      return
    }
    if (isIosWithoutPwa()) {
      setState('ios')
      return
    }
    if (!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)) {
      setState('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setState('blocked')
      return
    }
    if (profile) {
      const prefs = await loadModuleNotificationPrefs(profile.id)
      const med = prefs.find((row) => row.module === 'medicamentos')
      setMedEnabled(med?.enabled ?? true)
    }
    if (Notification.permission === 'granted') {
      const registration = await navigator.serviceWorker.ready
      const sub = await registration.pushManager.getSubscription()
      setState(sub ? 'ready' : 'prompt')
      return
    }
    setState('prompt')
  }, [profile])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function activate() {
    if (!profile) return
    setBusy(true)
    setMessage('')
    try {
      const readiness: PushReadiness = await subscribeToPush(profile.id)
      if (readiness === 'ios_needs_pwa') {
        setState('ios')
        return
      }
      if (readiness === 'denied') {
        setState('blocked')
        return
      }
      if (readiness === 'unsupported') {
        setState('unsupported')
        return
      }
      if (readiness === 'not_configured') {
        setState('not_configured')
        return
      }
      await setModuleNotificationPref({ userId: profile.id, module: 'medicamentos', enabled: true })
      setMedEnabled(true)
      setState('ready')
    } catch {
      setMessage('No pude activar los avisos. Revisá la conexión y probá de nuevo.')
      setState('prompt')
    } finally {
      setBusy(false)
    }
  }

  async function turnOffDevice() {
    setBusy(true)
    try {
      await unsubscribeFromPush()
      setState('prompt')
    } catch {
      setMessage('No pude apagar los avisos en este celu.')
    } finally {
      setBusy(false)
    }
  }

  async function toggleMed(next: boolean) {
    if (!profile) return
    setMedEnabled(next)
    try {
      await setModuleNotificationPref({ userId: profile.id, module: 'medicamentos', enabled: next })
    } catch {
      setMedEnabled(!next)
      setMessage('No pude guardar la preferencia.')
    }
  }

  async function sendTest() {
    if (!profile) return
    setBusy(true)
    setMessage('')
    try {
      const registration = await navigator.serviceWorker.ready
      const sub = await registration.pushManager.getSubscription()
      if (!sub) {
        setMessage('Activá los avisos en este celu primero.')
        return
      }
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const base = import.meta.env.VITE_SUPABASE_URL
      if (!token || !base) {
        setMessage('Todavía no puedo mandar la prueba desde acá.')
        return
      }
      const response = await fetch(`${base}/functions/v1/dispatch-push-reminders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'test', endpoint: sub.endpoint }),
      })
      if (!response.ok) {
        setMessage('No pude mandar el aviso de prueba. Probá de nuevo.')
        return
      }
      setMessage('Te mandé un aviso de prueba a este celu.')
    } catch {
      setMessage('No pude mandar el aviso de prueba. Probá de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <header className="mb-4 flex min-h-11 items-center gap-3">
        <button
          type="button"
          aria-label="Volver"
          className="grid h-11 w-11 place-items-center rounded-full bg-card shadow-soft"
          onClick={() => navigate(backTo)}
        >
          <AppIcon name="chevron-left" />
        </button>
        <h1 className="font-display text-[1.8rem] font-semibold">Notificaciones</h1>
      </header>

      {state === 'loading' ? <p className="font-semibold text-muted">Cargando…</p> : null}

      {state === 'prompt' ? (
        <section className="rounded-2xl border-2 border-azul-ink bg-card p-4">
          <h2 className="font-display text-xl font-semibold">Avisos en este celu</h2>
          <p className="mt-2 font-semibold">
            Te llegan aunque la app esté cerrada. Para eso, el navegador te va a pedir permiso.
          </p>
          <p className="mt-2 text-sm font-semibold text-muted">Medicamentos te avisa a la hora de cada toma.</p>
          {message ? (
            <p className="mt-2 text-sm font-bold text-tinta" role="alert">
              {message}
            </p>
          ) : null}
          <div className="mt-4 space-y-2">
            <Button tall className="w-full" disabled={busy} onClick={() => void activate()}>
              {busy ? 'Activando…' : 'Activar avisos'}
            </Button>
            <Button tall variant="alt" className="w-full" onClick={() => navigate(backTo)}>
              Ahora no
            </Button>
          </div>
        </section>
      ) : null}

      {state === 'ready' ? (
        <section className="space-y-3">
          <div className="rounded-2xl border-2 border-azul-ink bg-card p-4">
            <h2 className="font-display text-xl font-semibold">Activados en este celu</h2>
            <p className="mt-2 font-semibold">Te llegan aunque la app esté cerrada.</p>
          </div>
          <div className="rounded-2xl border-2 border-azul-ink bg-card p-4">
            <h3 className="mb-3 font-semibold">Qué te avisa</h3>
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Medicamentos</p>
                <p className="text-sm font-semibold text-muted">A la hora de cada toma. Vale para todos tus celus.</p>
              </div>
              <ModuleSwitch on={medEnabled} label="Medicamentos" onToggle={() => void toggleMed(!medEnabled)} />
            </div>
          </div>
          <Button tall variant="alt" className="w-full" disabled={busy} onClick={() => void sendTest()}>
            Mandarme un aviso de prueba
          </Button>
          <Button tall variant="alt" className="w-full" disabled={busy} onClick={() => void turnOffDevice()}>
            Apagar en este celu
          </Button>
          {message ? (
            <p className="text-center text-sm font-bold text-tinta" role="alert">
              {message}
            </p>
          ) : null}
        </section>
      ) : null}

      {state === 'blocked' ? (
        <section className="rounded-2xl border-2 border-azul-ink bg-card p-4">
          <h2 className="font-display text-xl font-semibold">Están bloqueados</h2>
          <p className="mt-2 font-semibold">El navegador no deja que la app te avise. Se cambia en el navegador, no acá.</p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm font-semibold">
            <li>Tocá el candado de la barra de direcciones.</li>
            <li>Permisos › Notificaciones › Permitir.</li>
            <li>Si instalaste la app: mantené apretado el ícono › Información › Notificaciones.</li>
          </ol>
          <Button className="mt-4 w-full" variant="alt" onClick={() => void refresh()}>
            Ya lo cambié
          </Button>
        </section>
      ) : null}

      {state === 'unsupported' ? (
        <section className="rounded-2xl border-2 border-azul-ink bg-card p-4">
          <h2 className="font-display text-xl font-semibold">Este navegador no avisa</h2>
          <p className="mt-2 font-semibold">No puede recibir avisos con la app cerrada.</p>
          <p className="mt-2 text-sm font-semibold text-muted">
            Probá Chrome o Edge en Android, o Safari en iPhone con la app en inicio.
          </p>
          <p className="mt-2 text-sm font-semibold text-muted">
            Igual podés usar Medicamentos: las tomas de hoy se ven y se marcan en la app.
          </p>
        </section>
      ) : null}

      {state === 'ios' ? (
        <section className="rounded-2xl border-2 border-azul-ink bg-card p-4">
          <h2 className="font-display text-xl font-semibold">Primero, instalá la app</h2>
          <p className="mt-2 font-semibold">
            Los avisos llegan solo si abrís A Medias desde la pantalla de inicio, no desde Safari.
          </p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm font-semibold">
            <li>Tocá Compartir.</li>
            <li>Elegí «Agregar a inicio».</li>
            <li>Abrí A Medias desde el ícono nuevo.</li>
          </ol>
          <p className="mt-3 text-sm font-semibold text-muted">Hace falta iOS 16.4 o más nuevo.</p>
        </section>
      ) : null}

      {state === 'not_configured' ? (
        <section className="rounded-2xl border-2 border-azul-ink bg-card p-4">
          <h2 className="font-display text-xl font-semibold">Los avisos todavía no están listos</h2>
          <p className="mt-2 font-semibold">Mientras tanto, las tomas de hoy se ven y se marcan en la app.</p>
        </section>
      ) : null}

      <p className="mt-6 text-center text-sm font-semibold text-muted">
        <Link to={backTo} className="text-mostaza-ink">
          Volver
        </Link>
      </p>
    </>
  )
}
