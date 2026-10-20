import { NavLink, useLocation } from 'react-router-dom'
import { AppIcon } from './AppIcon.tsx'

const LINKS = [
  { to: '/', label: 'Inicio', icon: 'house' },
  { to: '/se-me-fue', label: 'Gastos', icon: 'receipt' },
  { to: '/bolsa', label: 'Bolsa', icon: 'bag-shopping' },
  { to: '/meta', label: 'Meta', icon: 'umbrella-beach' },
  { to: '/recordatorios', label: 'Avisos', icon: 'bell' },
]

export function BottomNav() {
  const { pathname } = useLocation()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto flex h-[74px] max-w-[430px] items-center justify-around border-t border-line bg-card px-1 pb-1.5">
      {LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.to === '/'}
          className={({ isActive }) => {
            const active = link.to === '/' ? pathname === '/' || pathname === '/mi-anio' : isActive
            return `flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 text-[10px] font-bold ${
              active ? 'text-primary' : 'text-muted'
            }`
          }}
        >
          {({ isActive }) => {
            const active = link.to === '/' ? pathname === '/' || pathname === '/mi-anio' : isActive
            return (
              <>
                <span className={`text-lg leading-none ${active ? 'rounded-2xl bg-sage-light px-3.5 py-1.5' : ''}`}>
                  <AppIcon name={link.icon} />
                </span>
                {link.label}
              </>
            )
          }}
        </NavLink>
      ))}
    </nav>
  )
}
