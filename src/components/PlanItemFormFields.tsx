import { AppIcon } from './AppIcon.tsx'
import { MoneyField } from './MoneyField.tsx'
import { Chip, Toggle, inputClass } from './ui.tsx'

export type PlanItemDraft = {
  title: string
  digits: string
  note: string
  tag: string
  isPrivate: boolean
}

export function PlanItemFormFields({
  draft,
  onChange,
  tagSuggestions,
  showPrivateToggle,
  privateLockedLabel,
}: {
  draft: PlanItemDraft
  onChange: (next: PlanItemDraft) => void
  tagSuggestions: readonly string[]
  /** Alta: toggle Privado. Edición de privado: solo etiqueta. */
  showPrivateToggle: boolean
  privateLockedLabel?: boolean
}) {
  return (
    <>
      <label className="mb-4 block text-sm font-semibold text-gris">
        Nombre
        <input
          value={draft.title}
          maxLength={80}
          onChange={(event) => onChange({ ...draft, title: event.target.value })}
          className={`mt-1.5 ${inputClass}`}
        />
      </label>
      <div className="mb-4">
        <MoneyField
          label="Importe"
          draft={draft.digits}
          onDraft={(digits) => onChange({ ...draft, digits })}
          size="form"
        />
      </div>
      <label className="mb-4 block text-sm font-semibold text-gris">
        Observación
        <textarea
          value={draft.note}
          rows={3}
          maxLength={500}
          onChange={(event) => onChange({ ...draft, note: event.target.value.slice(0, 500) })}
          className={`mt-1.5 min-h-[72px] resize-none ${inputClass}`}
        />
      </label>
      <label className="mb-2 block text-sm font-semibold text-gris">
        Etiqueta
        <input
          value={draft.tag}
          maxLength={24}
          onChange={(event) => onChange({ ...draft, tag: event.target.value.slice(0, 24) })}
          className={`mt-1.5 ${inputClass}`}
        />
      </label>
      {tagSuggestions.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {tagSuggestions.map((tag) => (
            <Chip
              key={tag}
              active={draft.tag.trim().toLocaleLowerCase('es') === tag.toLocaleLowerCase('es')}
              onClick={() => onChange({ ...draft, tag })}
            >
              {tag}
            </Chip>
          ))}
        </div>
      ) : (
        <div className="mb-4" />
      )}
      {showPrivateToggle ? (
        <div className="mb-4">
          <Toggle
            label="Privado"
            checked={draft.isPrivate}
            onClick={() => onChange({ ...draft, isPrivate: !draft.isPrivate })}
          />
        </div>
      ) : privateLockedLabel ? (
        <p className="mb-4 flex min-h-11 items-center gap-2 text-sm font-semibold text-gris">
          <AppIcon name="lock" className="text-sm" /> Privado
        </p>
      ) : null}
    </>
  )
}
