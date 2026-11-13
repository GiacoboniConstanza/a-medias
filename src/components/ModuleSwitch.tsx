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
  tone?: 'sage' | 'azul'
  onToggle: () => void
}) {
  const track = disabled
    ? 'border-[1.5px] border-dashed border-gris-claro bg-fondo-desactivado'
    : on
      ? `border-[1.5px] border-tinta ${tone === 'azul' ? 'bg-azul' : 'bg-mostaza'}`
      : 'border-[1.5px] border-gris bg-sand'
  const knobs = disabled
    ? 'border-[1.5px] border-gris-claro bg-sand-soft shadow-none'
    : 'bg-sand-soft shadow-soft'
  const check = disabled ? 'text-gris' : 'text-tinta'
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
      {on ? <AppIcon name="check" className={`absolute left-2.5 top-1/2 -translate-y-1/2 text-sm ${check}`} /> : null}
      <span aria-hidden="true" className={`absolute top-1 h-9 w-9 rounded-full ${knobs} ${on ? 'left-6' : 'left-1'}`} />
    </button>
  )
}
