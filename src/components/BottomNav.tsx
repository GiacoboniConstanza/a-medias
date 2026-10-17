import { NavLink } from 'react-router-dom'
import { AppIcon } from './AppIcon.tsx'

const LINKS = [
  { to: '/', label: 'Inicio', icon: 'house' },
  { to: '/se-me-fue', label: 'Gastos', icon: 'chart-pie' },
  { to: '/bolsa', label: 'Bolsa', icon: 'bag-shopping' },
  { to: '/meta', label: 'Meta', icon: 'umbrella-beach' },
  { to: '/recordatorios', label: 'Avisos', icon: 'calendar-days' },
]

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto grid max-w-[430px] grid-cols-5 gap-1 border-t border-line bg-canvas/95 px-2 py-2 backdrop-blur">
      {LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.to === '/'}
          className={({ isActive }) =>
            `flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 px-1 text-[13px] font-semibold ${
              isActive ? 'border-active bg-active text-white' : 'border-edge text-ink'
            }`
          }
        >
          <AppIcon name={link.icon} />
          {link.label}
        </NavLink>
      ))}
    </nav>
  )
}
