import { Link, useLocation } from 'react-router-dom'
import { useModules } from '../context/ModulesProvider.tsx'
import { navFor } from '../lib/modules.ts'
import { AppIcon } from './AppIcon.tsx'

export function BottomNav() {
  const location = useLocation()
  const { enabled, ready } = useModules()
  const from = (location.state as { from?: string } | null)?.from ?? null
  const { items, activeTo } = navFor(location.pathname, ready ? enabled : ['finanzas'], from)
  return (
    <nav aria-label="Secciones" className="scallop-t fixed inset-x-0 bottom-0 z-20 mx-auto flex h-[76px] max-w-[430px] items-center justify-around bg-azul px-1 pb-1.5 text-tinta">
      {items.map((link) => {
        const active = link.to === activeTo
        return (
          <Link
            key={link.to}
            to={link.to}
            aria-current={active ? 'page' : undefined}
            aria-label={link.label}
            className="flex min-h-14 min-w-12 shrink-0 flex-col items-center justify-center gap-0.5 whitespace-nowrap px-1 text-sm font-semibold leading-none text-tinta"
          >
            <span className={`grid h-[30px] w-[52px] place-items-center rounded-full ${active ? 'bg-tarjeta' : ''}`}>
              <AppIcon name={link.icon} className="text-lg" />
            </span>
            <span className="max-[359px]:sr-only">{link.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
