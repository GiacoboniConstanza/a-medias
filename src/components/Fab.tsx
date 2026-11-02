import { Link } from 'react-router-dom'
import { AppIcon } from './AppIcon.tsx'

export function Fab({ to, label, state }: { to: string; label: string; state?: unknown }) {
  return (
    <Link
      to={to}
      state={state}
      aria-label={label}
      className="fixed bottom-24 right-[max(1.25rem,calc(50vw-195px))] z-30 grid h-[52px] w-[52px] place-items-center rounded-full bg-primary text-on-primary shadow-fab-lite"
    >
      <AppIcon name="plus" className="text-xl" />
    </Link>
  )
}
