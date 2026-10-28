import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AppIcon } from '../components/AppIcon.tsx'
import { ModuleSwitch } from '../components/ModuleSwitch.tsx'
import { Planter, Sprout } from '../components/Sprout.tsx'
import { useModules } from '../context/ModulesProvider.tsx'
import { isComingSoon, MODULES, MODULE_META, moduleSwitchLocked, type ModuleId } from '../lib/modules.ts'

export function ModulesScreen() {
  const { enabled, toggle } = useModules()
  const [error, setError] = useState('')

  async function onToggle(module: ModuleId, next: boolean) {
    setError('')
    try {
      await toggle(module, next)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo cambiar el módulo.')
    }
  }

  return (
    <>
      <header className="mb-4 flex min-h-11 items-center justify-between gap-3">
        <p className="text-[15px] font-semibold text-muted">
          <AppIcon name="sliders" className="mr-1.5" /> Ajustes
        </p>
        <Link to="/" aria-label="Cerrar" className="grid h-11 w-11 place-items-center rounded-full bg-card text-primary shadow-soft">
          <AppIcon name="xmark" />
        </Link>
      </header>
      <h1 className="font-display text-[1.8rem] font-bold leading-tight">Mis módulos</h1>
      <section className="mb-3 mt-3.5 flex items-center gap-3 rounded-3xl bg-gradient-to-br from-card to-[#EEF4E6] p-3 shadow-card">
        <Planter />
        <p className="text-sm font-bold leading-snug">
          Elegí qué querés ver. Lo que apagues queda como semillita, por si algún día lo querés.
        </p>
      </section>
      <ul>
        {MODULES.map((module) => {
          const meta = MODULE_META[module]
          const on = enabled.includes(module)
          const soon = isComingSoon(module)
          const locked = on && moduleSwitchLocked(enabled, module)
          const detail = soon ? 'Próximamente' : locked ? 'Tu único módulo activo' : meta.detail
          return (
            <li
              key={module}
              className="mb-2.5 flex min-h-16 items-center gap-3 rounded-[20px] bg-card px-3.5 py-3 shadow-soft"
            >
              <Sprout module={module} muted={!on} />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-extrabold">{meta.label}</p>
                <p className="text-[12.5px] font-semibold text-muted">{detail}</p>
              </div>
              <ModuleSwitch
                on={on}
                disabled={locked || (soon && !on)}
                label={meta.label}
                onToggle={() => void onToggle(module, !on)}
              />
            </li>
          )
        })}
      </ul>
      {error ? <p className="mb-3 text-center text-sm font-bold text-alert-ink">{error}</p> : null}
      <p className="mt-3 flex gap-2 px-1.5 text-[12.5px] font-semibold leading-snug text-muted">
        <AppIcon name="circle-info" className="mt-0.5 shrink-0 text-primary" />
        <span>
          Siempre queda al menos un módulo prendido. Aunque no uses Memos, vas a ver en tu Inicio los que te compartan.
        </span>
      </p>
    </>
  )
}

export function ComingSoonScreen({ module }: { module: ModuleId }) {
  const meta = MODULE_META[module]
  return (
    <section className="py-10 text-center">
      <div className="mb-4 flex justify-center">
        <Sprout module={module} muted />
      </div>
      <h1 className="font-display text-[1.8rem] font-bold">{meta.label}</h1>
      <p className="mt-2 font-bold text-muted">Próximamente</p>
      <Link to="/" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-2xl bg-primary px-5 font-extrabold text-white">
        Volver al inicio
      </Link>
    </section>
  )
}
