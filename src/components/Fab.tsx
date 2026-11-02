import { Link } from 'react-router-dom'
import { AppIcon } from './AppIcon.tsx'

const fabClass =
  'fixed bottom-24 right-[max(1.25rem,calc(50vw-195px))] z-30 grid h-[52px] w-[52px] place-items-center rounded-full bg-primary text-on-primary shadow-fab-lite'

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
