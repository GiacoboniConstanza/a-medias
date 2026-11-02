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
  size?: 'large' | 'display'
}) {
  const type = size === 'large' ? 'text-[44px] leading-none' : 'text-4xl leading-none'
  return (
    <div className="mb-3 text-center">
      <p className="text-base font-bold text-muted">{label}</p>
      <div className={`mt-1 flex items-center justify-center font-display font-bold ${type}`}>
        <MoneyInput
          draft={draft}
          onDraft={onDraft}
          readOnly={readOnly}
          label={label}
          className="min-h-11 w-full max-w-[16rem] bg-transparent text-center font-display font-bold outline-none"
        />
      </div>
      {error ? <p className="mt-1 text-base font-bold text-[#85503C]">{error}</p> : null}
      {readOnly ? null : (
        <div className="mt-2">
          <Keypad onKey={(key) => onDraft(applyMoneyKey(draft, key))} />
        </div>
      )}
    </div>
  )
}
