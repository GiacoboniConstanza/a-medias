import { AppIcon } from './AppIcon.tsx'

export function ModuleSwitch({
  on,
  label,
  disabled = false,
  tone = 'sage',
  onToggle,
}: {
  on: boolean
  label: string
  disabled?: boolean
  tone?: 'sage' | 'lavender'
  onToggle: () => void
}) {
  const track = on ? (tone === 'lavender' ? 'bg-lavender' : 'bg-primary') : 'bg-sand'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={`relative h-11 w-16 shrink-0 rounded-full ${track} disabled:cursor-not-allowed`}
    >
      {on ? <AppIcon name="check" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-on-primary" /> : null}
      <span aria-hidden="true" className={`absolute top-1 h-9 w-9 rounded-full bg-sand-soft shadow-soft ${on ? 'left-6' : 'left-1'}`} />
    </button>
  )
}
