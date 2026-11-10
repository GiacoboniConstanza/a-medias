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
  showKeypad = true,
  autoFocus = false,
}: {
  draft: string
  onDraft: (value: string) => void
  readOnly?: boolean
  error?: string
  label?: string
  size?: 'large' | 'display' | 'hero' | 'form'
  showKeypad?: boolean
  autoFocus?: boolean
}) {
  const form = size === 'form'
  const hero = size === 'hero'
  const type = form
    ? 'text-[36px] font-semibold leading-none'
    : hero
      ? 'text-[38px] font-semibold leading-none'
      : size === 'large'
        ? 'text-[44px] font-bold leading-none'
        : 'text-4xl font-bold leading-none'
  return (
    <div className={form ? 'mb-0' : 'mb-3 text-center'}>
      <p className={`font-semibold text-gris ${form ? 'text-sm' : 'text-base font-bold text-muted'}`}>{label}</p>
      <div
        className={
          form
            ? `mt-1 flex min-h-14 items-center rounded-2xl border-2 bg-tarjeta px-3 font-display ${type} ${
                error ? 'border-tinta' : 'border-azul-ink'
              }`
            : `mt-1 flex items-center justify-center font-display ${type}`
        }
      >
        <MoneyInput
          draft={draft}
          onDraft={onDraft}
          readOnly={readOnly}
          label={label}
          autoFocus={autoFocus}
          className={
            form
              ? 'min-h-11 w-full bg-transparent font-display text-[36px] font-semibold outline-none'
              : 'min-h-11 w-full max-w-[16rem] bg-transparent text-center font-display font-semibold outline-none'
          }
        />
      </div>
      {error ? (
        <p className={`mt-1 flex items-center gap-1 text-sm font-bold text-tinta`} role="alert">
          {error}
        </p>
      ) : null}
      {readOnly || !showKeypad ? null : (
        <div className="mt-2">
          <Keypad onKey={(key) => onDraft(applyMoneyKey(draft, key))} />
        </div>
      )}
    </div>
  )
}
