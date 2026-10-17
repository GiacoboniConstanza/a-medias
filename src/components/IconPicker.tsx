import { AppIcon } from './AppIcon.tsx'
import { Chip } from './ui.tsx'
import { ICON_CHOICES } from '../lib/icons.ts'

export function IconPicker({ value, onChange }: { value: string; onChange: (name: string) => void }) {
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
