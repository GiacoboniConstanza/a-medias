import { Chip } from './ui.tsx'
import { PAID_CHIPS, SCOPE_CHIPS, type PaidFilter, type ScopeFilter } from '../lib/finance-filters.ts'

export function ScopeChips({ value, onChange }: { value: ScopeFilter; onChange: (value: ScopeFilter) => void }) {
  return (
    <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Alcance">
      {SCOPE_CHIPS.map((option) => (
        <Chip key={option.id} active={value === option.id} onClick={() => onChange(option.id)}>
          {option.label}
        </Chip>
      ))}
    </div>
  )
}

export function PaidChips({ value, onChange }: { value: PaidFilter; onChange: (value: PaidFilter) => void }) {
  return (
    <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Estado">
      {PAID_CHIPS.map((option) => (
        <Chip key={option.id} active={value === option.id} onClick={() => onChange(option.id)}>
          {option.label}
        </Chip>
      ))}
    </div>
  )
}
