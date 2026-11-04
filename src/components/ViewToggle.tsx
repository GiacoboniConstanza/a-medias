import { AppIcon } from './AppIcon.tsx'
import type { ViewMode } from '../types/database.ts'

export function ViewToggle({
  mode,
  onChange,
  className = '',
}: {
  mode: ViewMode
  onChange: (mode: ViewMode) => void
  className?: string
}) {
  return (
    <div className={`flex rounded-full bg-sand p-[3px] ${className}`} role="radiogroup" aria-label="Ver como">
      <ToggleButton active={mode === 'friendly'} icon="seedling" label="Amigable" onClick={() => onChange('friendly')} />
      <ToggleButton active={mode === 'accounting'} icon="table-list" label="Contable" onClick={() => onChange('accounting')} />
    </div>
  )
}

function ToggleButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: string
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-base font-bold ${
        active ? 'border-[1.5px] border-tinta bg-mostaza text-tinta' : 'text-muted'
      }`}
    >
      <AppIcon name={icon} className="text-sm" />
      {label}
    </button>
  )
}
