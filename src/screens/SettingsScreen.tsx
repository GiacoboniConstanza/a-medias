import { Link } from 'react-router'
import { AppIcon } from '../components/AppIcon.tsx'
import { SectionHeader } from '../components/SectionHeader.tsx'
import { useModules } from '../context/ModulesProvider.tsx'
import { isHubHome } from '../lib/modules.ts'

const ROWS = [
  { to: '/reparto', label: 'Reparto', icon: 'scale-balanced' },
  { to: '/sueldo', label: 'Sueldos', icon: 'building' },
  { to: '/ajustes/categorias', label: 'Categorías', icon: 'tag' },
] as const

export function SettingsScreen() {
  const { enabled } = useModules()
  const backTo = isHubHome(enabled) ? '/finanzas' : '/'

  return (
    <>
      <SectionHeader lead="back" backTo={backTo} title="Ajustes" screenTitle />
      <div className="mt-2 overflow-hidden rounded-2xl border-2 border-azul-ink bg-tarjeta">
        {ROWS.map((row) => (
          <Link
            key={row.to}
            to={row.to}
            state={{ from: '/ajustes' }}
            className="grid min-h-[68px] grid-cols-[40px_1fr_24px] items-center gap-3 border-b border-dashed border-linea-punteada px-3.5 py-2.5 last:border-0"
          >
            <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-azul-ink bg-azul-claro text-tinta">
              <AppIcon name={row.icon} />
            </span>
            <span className="font-display text-lg font-semibold text-tinta">{row.label}</span>
            <AppIcon name="chevron-right" className="justify-self-end text-tinta" />
          </Link>
        ))}
      </div>
    </>
  )
}
