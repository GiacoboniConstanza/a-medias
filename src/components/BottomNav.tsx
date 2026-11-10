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
    <nav
      aria-label="Secciones"
      className="scallop-t fixed inset-x-0 bottom-0 z-20 flex h-[76px] w-screen items-center justify-around bg-azul pb-1.5 text-tinta"
      style={{ paddingInline: 'max(16px, calc((100vw - var(--ancho-columna)) / 2 + 16px))' }}
    >
      {items.map((link) => {
        const active = link.action === 'cargar' ? false : link.to === activeTo
        if (link.action === 'cargar') {
          return (
            <Link
              key={link.to}
              to={link.to}
              state={{ from: location.pathname }}
              aria-label={link.label}
              className="flex min-h-14 min-w-12 shrink-0 flex-col items-center justify-center gap-0.5 whitespace-nowrap px-1 text-sm font-semibold leading-none text-tinta"
            >
              <span className="grid h-12 w-12 place-items-center rounded-full border-[1.5px] border-tinta bg-mostaza text-tinta">
                <AppIcon name="plus" className="text-lg" />
              </span>
              <span className="max-[359px]:sr-only font-medium">{link.label}</span>
            </Link>
          )
        }
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
            <span className={`max-[359px]:sr-only ${active ? 'font-bold' : 'font-medium'}`}>{link.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
