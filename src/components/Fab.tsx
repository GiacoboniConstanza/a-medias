import { Link } from 'react-router-dom'
import { AppIcon } from './AppIcon.tsx'

const fabClass =
  'fixed right-[max(16px,calc((100vw-var(--ancho-columna))/2+16px))] z-30 grid h-[var(--alto-fab)] w-[var(--alto-fab)] place-items-center rounded-full border-[1.5px] border-tinta bg-mostaza text-lg text-tinta bottom-[calc(var(--espacio-fab-abajo)+env(safe-area-inset-bottom))]'

export function FabSpace({ avisos = false }: { avisos?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={avisos ? 'h-[var(--espacio-final-con-aviso)]' : 'h-[var(--espacio-final-con-fab)]'}
    />
  )
}

export function Fab({
  to,
  label,
  state,
  onClick,
}: {
  to?: string
  label: string
  state?: unknown
  onClick?: () => void
}) {
  const icon = <AppIcon name="plus" className="text-xl" />
  if (onClick || !to) {
    return (
      <button type="button" aria-label={label} onClick={onClick} className={fabClass}>
        {icon}
      </button>
    )
  }
  return (
    <Link to={to} state={state} aria-label={label} className={fabClass}>
      {icon}
    </Link>
  )
}
