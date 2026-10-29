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
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto flex h-[74px] max-w-[430px] items-center justify-around border-t border-line bg-card px-1 pb-1.5">
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
            className={`flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 text-[10px] font-bold ${
              active ? 'text-primary' : 'text-muted'
            }`}
          >
            <span className={`text-lg leading-none ${active ? 'rounded-2xl bg-sage-light px-3.5 py-1.5' : ''}`}>
              <AppIcon name={link.icon} />
            </span>
            {link.label}
          </NavLink>
        )
      })}
    </nav>
  )
}
