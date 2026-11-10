import { useLayoutEffect, useRef } from 'react'
import { applyMoneyInput, formatMoneyDraft, padMoneyDraft } from '../lib/format.ts'

export function MoneyInput({
  draft,
  onDraft,
  readOnly = false,
  label = 'Monto',
  className = '',
  autoFocus = false,
}: {
  draft: string
  onDraft: (value: string) => void
  readOnly?: boolean
  label?: string
  className?: string
  autoFocus?: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  const caretRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    const input = ref.current
    const pos = caretRef.current
    if (!input || pos == null) return
    input.setSelectionRange(pos, pos)
    caretRef.current = null
  })

  useLayoutEffect(() => {
    if (!autoFocus || readOnly) return
    ref.current?.focus()
  }, [autoFocus, readOnly])

  return (
    <span className="inline-flex min-w-0 max-w-full items-center justify-center">
      <span aria-hidden="true" className="shrink-0">
        ${'\u00a0'}
      </span>
      <input
        ref={ref}
        inputMode="decimal"
        enterKeyHint="done"
        autoComplete="off"
        autoFocus={autoFocus}
        readOnly={readOnly}
        value={formatMoneyDraft(draft)}
        aria-label={label}
        placeholder="0"
        onChange={(event) => {
          if (readOnly) return
          const next = applyMoneyInput(draft, event.target.value, event.target.selectionStart ?? event.target.value.length)
          caretRef.current = next.caret
          if (next.draft === draft) event.target.setSelectionRange(next.caret, next.caret)
          onDraft(next.draft)
        }}
        onBlur={() => {
          if (readOnly) return
          const padded = padMoneyDraft(draft)
          if (padded !== draft) onDraft(padded)
        }}
        className={className}
      />
    </span>
  )
}
