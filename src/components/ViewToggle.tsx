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
    <div className={`flex rounded-full bg-sand p-1 ${className}`} role="group" aria-label="Vista">
      <ToggleButton active={mode === 'friendly'} onClick={() => onChange('friendly')}>
        Amigable
      </ToggleButton>
      <ToggleButton active={mode === 'accounting'} onClick={() => onChange('accounting')}>
        Contable
      </ToggleButton>
    </div>
  )
}

function ToggleButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-extrabold ${
        active ? 'bg-primary text-white' : 'text-muted'
      }`}
    >
      {active ? <AppIcon name="check" /> : null}
      {children}
    </button>
  )
}
