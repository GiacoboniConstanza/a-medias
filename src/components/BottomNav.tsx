import { NavLink, useLocation } from 'react-router-dom'
import { useModules } from '../context/ModulesProvider.tsx'
import { isHubHome, navForModules } from '../lib/modules.ts'
import { AppIcon } from './AppIcon.tsx'

export function BottomNav() {
  const { pathname } = useLocation()
  const { enabled, ready } = useModules()
  const links = navForModules(ready ? enabled : ['finanzas'])
  const financeHome = !isHubHome(ready ? enabled : ['finanzas'])
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto flex h-[74px] max-w-[430px] items-center justify-around overflow-x-auto border-t border-line bg-card px-1 pb-1.5">
      {links.map((link) => {
        const active =
          link.to === '/'
            ? financeHome
              ? pathname === '/' || pathname === '/mi-anio'
              : pathname === '/'
            : pathname === link.to
        return (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end ?? link.to === '/'}
            className={`flex min-h-11 min-w-11 shrink-0 flex-col items-center justify-center gap-0.5 whitespace-nowrap rounded-2xl px-1.5 text-[14px] font-semibold leading-none ${
              active ? 'bg-sage-light text-primary' : 'text-muted'
            }`}
          >
            <span className="text-base leading-none">
              <AppIcon name={link.icon} />
            </span>
            {link.label}
          </NavLink>
        )
      })}
    </nav>
  )
}
