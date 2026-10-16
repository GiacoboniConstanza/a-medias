import { NavLink } from 'react-router-dom'

const LINKS = [
  { to: '/', label: 'Inicio', icon: '🏠' },
  { to: '/se-me-fue', label: 'Gastos', icon: '🫧' },
  { to: '/bolsa', label: 'Bolsa', icon: '👜' },
  { to: '/meta', label: 'Meta', icon: '🏖️' },
  { to: '/recordatorios', label: 'Avisos', icon: '📅' },
]

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto grid max-w-[430px] grid-cols-5 border-t border-line bg-canvas/95 px-1 py-2 backdrop-blur">
      {LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.to === '/'}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 text-[11px] font-extrabold ${isActive ? 'text-brand' : 'text-muted'}`
          }
        >
          <span className="text-lg">{link.icon}</span>
          {link.label}
        </NavLink>
      ))}
    </nav>
  )
}
