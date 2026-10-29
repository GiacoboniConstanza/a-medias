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
  const track = on ? (tone === 'lavender' ? 'bg-[#7E70AE]' : 'bg-primary') : 'bg-[#e3d8c9]'
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
      {on ? <AppIcon name="check" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-white" /> : null}
      <span aria-hidden="true" className={`absolute top-1 h-9 w-9 rounded-full bg-white shadow-soft ${on ? 'left-6' : 'left-1'}`} />
    </button>
  )
}
