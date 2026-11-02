import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useModules } from '../context/ModulesProvider.tsx'
import { MODULES, MODULE_META, type ModuleId } from '../lib/modules.ts'
import { AppIcon } from './AppIcon.tsx'
import { Sheet } from './Sheet.tsx'

export function ModuleCrumb({ module = 'finanzas' }: { module?: ModuleId }) {
  const [open, setOpen] = useState(false)
  const { enabled } = useModules()
  const navigate = useNavigate()
  const meta = MODULE_META[module]
  const active = MODULES.filter((id) => enabled.includes(id))
  return (
    <>
      <div className="inline-flex h-[46px] items-center rounded-full border border-line bg-card">
        <Link to="/" aria-label="Ir al Inicio" className="grid h-11 w-11 place-items-center text-alert-ink">
          <AppIcon name="house" className="text-base" />
        </Link>
        <span className="h-5 w-px shrink-0 bg-line" aria-hidden="true" />
        <button
          type="button"
          className="inline-flex h-11 items-center gap-[5px] rounded-full pl-1.5 pr-2.5"
          aria-label={`Estás en ${meta.label}. Cambiar de módulo`}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <span className={`hidden h-[26px] w-[26px] place-items-center rounded-full max-[359px]:grid min-[390px]:grid ${meta.tone}`}>
            <AppIcon name={meta.icon} className={`text-sm ${meta.ink}`} />
          </span>
          <span className="font-display text-base font-medium text-title max-[359px]:hidden">{meta.label}</span>
          <AppIcon name="chevron-down" className="text-sm text-muted" />
        </button>
      </div>
      <Sheet open={open} title="Ir a" onClose={() => setOpen(false)}>
        <ul>
          {active.map((id) => {
            const item = MODULE_META[id]
            const current = id === module
            return (
              <li key={id}>
                <button
                  type="button"
                  aria-current={current ? 'page' : undefined}
                  className={`flex min-h-[62px] w-full items-center gap-3 rounded-2xl px-1 text-left ${current ? 'bg-sage-soft' : ''}`}
                  onClick={() => {
                    setOpen(false)
                    navigate(item.to)
                  }}
                >
                  <span className={`grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full ${item.tone}`}>
                    <AppIcon name={item.icon} className={`text-lg ${item.ink}`} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-lg font-medium text-title">{item.label}</span>
                    <span className="block text-sm font-semibold text-muted">{item.detail}</span>
                  </span>
                  {current ? <AppIcon name="check" className="text-primary" /> : null}
                </button>
              </li>
            )
          })}
        </ul>
        <Link to="/modulos" onClick={() => setOpen(false)} className="mt-2 flex min-h-14 items-center gap-2 text-base font-bold text-title">
          <AppIcon name="sliders" className="text-primary" />
          Mis módulos
        </Link>
      </Sheet>
    </>
  )
}

export function ModuleTitle({ module }: { module: ModuleId }) {
  const meta = MODULE_META[module]
  return (
    <p className="inline-flex min-w-0 items-center gap-2">
      <span className={`grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full ${meta.tone}`}>
        <AppIcon name={meta.icon} className={`text-base ${meta.ink}`} />
      </span>
      <span className="font-display text-xl font-medium text-title">{meta.label}</span>
    </p>
  )
}
