import { AppIcon } from './AppIcon.tsx'
import { Chip } from './ui.tsx'
import { ICON_CHOICES } from '../lib/icons.ts'

export function IconPicker({
  value,
  onChange,
  layout = 'wrap',
}: {
  value: string
  onChange: (name: string) => void
  layout?: 'wrap' | 'grid'
}) {
  if (layout === 'grid') {
    return (
      <div className="grid grid-cols-6 gap-2" role="listbox" aria-label="Elegí un ícono">
        {ICON_CHOICES.map((choice) => {
          const active = value === choice.name
          return (
            <button
              key={choice.name}
              type="button"
              role="option"
              aria-selected={active}
              aria-label={choice.label}
              onClick={() => onChange(choice.name)}
              className={`grid aspect-square min-h-11 place-items-center rounded-2xl text-base ${
                active ? 'bg-primary text-white' : 'bg-sand text-text'
              }`}
            >
              <AppIcon name={choice.name} />
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2" role="listbox" aria-label="Elegí un ícono">
      {ICON_CHOICES.map((choice) => (
        <Chip key={choice.name} active={value === choice.name} onClick={() => onChange(choice.name)}>
          <AppIcon name={choice.name} />
          <span className="sr-only">{choice.label}</span>
        </Chip>
      ))}
    </div>
  )
}
