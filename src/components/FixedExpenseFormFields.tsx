import type { ReactNode } from 'react'
import { AppIcon } from './AppIcon.tsx'
import { MoneyField } from './MoneyField.tsx'
import { Chip, NotesField, Toggle, inputClass } from './ui.tsx'
import type { Category } from '../lib/api.ts'
import type { FixedKind } from '../lib/fixed-form.ts'

export type FixedExpenseFieldsProps = {
  kind: FixedKind
  title: string
  onTitle: (value: string) => void
  digits: string
  onDigits: (value: string) => void
  totalDigits: string
  onTotalDigits: (value: string) => void
  dueDay: string
  onDueDay: (value: string) => void
  shared: boolean
  onShared: () => void
  remind: boolean
  onRemind: () => void
  notes: string
  onNotes: (value: string) => void
  categoryId: string | null
  onCategoryId: (id: string | null) => void
  categoryChips: readonly Category[]
  showAllCategories: boolean
  onShowAllCategories: () => void
  categoriesTotal: number
  countText: string
  onCountText: (value: string) => void
  currentText: string
  onCurrentText: (value: string) => void
  firstCaption: string | null
  leadDays: number
  remindId: string
  amountChanged: boolean
  applies: 'this' | 'next' | null
  onApplies: (value: 'this' | 'next') => void
  autoFocusAmount?: boolean
  extraActions?: ReactNode
}

export function FixedExpenseFormFields({
  kind,
  title,
  onTitle,
  digits,
  onDigits,
  totalDigits,
  onTotalDigits,
  dueDay,
  onDueDay,
  shared,
  onShared,
  remind,
  onRemind,
  notes,
  onNotes,
  categoryId,
  onCategoryId,
  categoryChips,
  showAllCategories,
  onShowAllCategories,
  categoriesTotal,
  countText,
  onCountText,
  currentText,
  onCurrentText,
  firstCaption,
  leadDays,
  remindId,
  amountChanged,
  applies,
  onApplies,
  autoFocusAmount = false,
  extraActions,
}: FixedExpenseFieldsProps) {
  return (
    <>
      <label className="block text-sm font-semibold text-gris">
        Nombre
        <input
          value={title}
          onChange={(event) => onTitle(event.target.value.slice(0, 80))}
          className={`mt-1 ${inputClass}`}
          placeholder="Alquiler, luz, cama…"
        />
      </label>

      <MoneyField draft={digits} onDraft={onDigits} size="form" autoFocus={autoFocusAmount} />

      <div>
        <p className="mb-2 text-sm font-semibold text-gris">Categoría (opcional)</p>
        <div className="flex flex-wrap gap-2">
          {categoryChips.map((category) => (
            <Chip
              key={category.id}
              active={categoryId === category.id}
              onClick={() => onCategoryId(categoryId === category.id ? null : category.id)}
            >
              <AppIcon name={category.icon} className="text-sm" />
              {category.name}
            </Chip>
          ))}
          {!showAllCategories && categoriesTotal > categoryChips.length ? (
            <Chip onClick={onShowAllCategories}>Ver todas ({categoriesTotal})</Chip>
          ) : null}
        </div>
      </div>

      <Toggle label="¿Es compartido?" checked={shared} onClick={onShared} />

      {kind === 'installments' ? (
        <>
          <label className="block text-sm font-semibold text-gris">
            Cantidad
            <input
              value={countText}
              onChange={(event) => onCountText(event.target.value.replace(/\D/g, '').slice(0, 3))}
              inputMode="numeric"
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <label className="block text-sm font-semibold text-gris">
            Va por la cuota
            <input
              value={currentText}
              onChange={(event) => onCurrentText(event.target.value.replace(/\D/g, '').slice(0, 3))}
              inputMode="numeric"
              className={`mt-1 ${inputClass}`}
            />
          </label>
          {firstCaption ? <p className="text-sm font-semibold text-gris">{firstCaption}</p> : null}
          <MoneyField draft={totalDigits} onDraft={onTotalDigits} size="form" label="Total (opcional)" />
        </>
      ) : (
        <>
          <label className="block text-sm font-semibold text-gris">
            Día de vencimiento
            <input
              value={dueDay}
              onChange={(event) => onDueDay(event.target.value.replace(/\D/g, '').slice(0, 2))}
              inputMode="numeric"
              className={`mt-1 text-center font-display text-2xl ${inputClass}`}
            />
          </label>
          <div className="flex items-center justify-between gap-3">
            <p id={remindId} className="text-lg font-medium text-tinta">
              {leadDays <= 0
                ? 'Avisarme el mismo día'
                : leadDays === 1
                  ? 'Avisarme 1 día antes'
                  : `Avisarme ${leadDays} días antes`}
            </p>
            <Toggle labelledBy={remindId} checked={remind} onClick={onRemind} />
          </div>
          {amountChanged ? (
            <div>
              <p className="mb-2 text-sm font-semibold text-tinta">¿Desde cuándo aplica?</p>
              <div className="flex flex-wrap gap-2">
                <Chip active={applies === 'this'} onClick={() => onApplies('this')}>
                  Este mes
                </Chip>
                <Chip active={applies === 'next'} onClick={() => onApplies('next')}>
                  El mes que viene
                </Chip>
              </div>
            </div>
          ) : null}
          <NotesField value={notes} onChange={onNotes} />
        </>
      )}
      {extraActions}
    </>
  )
}
