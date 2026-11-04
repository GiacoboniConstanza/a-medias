import { MoneyInput } from './MoneyInput.tsx'
import { Keypad } from './Keypad.tsx'
import { applyMoneyKey } from '../lib/format.ts'

export function MoneyField({
  draft,
  onDraft,
  readOnly = false,
  error,
  label = 'Monto',
  size = 'large',
}: {
  draft: string
  onDraft: (value: string) => void
  readOnly?: boolean
  error?: string
  label?: string
  size?: 'large' | 'display' | 'hero'
}) {
  const hero = size === 'hero'
  const type = hero ? 'text-[38px] font-semibold leading-none' : size === 'large' ? 'text-[44px] font-bold leading-none' : 'text-4xl font-bold leading-none'
  return (
    <div className="mb-3 text-center">
      <p className="text-base font-bold text-muted">{label}</p>
      <div className={`mt-1 flex items-center justify-center font-display ${type}`}>
        <MoneyInput
          draft={draft}
          onDraft={onDraft}
          readOnly={readOnly}
          label={label}
          className={`min-h-11 w-full max-w-[16rem] bg-transparent text-center font-display outline-none ${hero ? 'font-semibold' : 'font-bold'}`}
        />
      </div>
      {error ? <p className="mt-1 text-base font-bold text-tinta">{error}</p> : null}
      {readOnly ? null : (
        <div className="mt-2">
          <Keypad onKey={(key) => onDraft(applyMoneyKey(draft, key))} />
        </div>
      )}
    </div>
  )
}
