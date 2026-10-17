import { AppIcon } from './AppIcon.tsx'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', '⌫']

export function Keypad({ onKey }: { onKey: (key: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onKey(key)}
          className="min-h-12 rounded-2xl bg-card text-center font-display text-[22px] font-semibold text-text shadow-soft"
        >
          {key === '⌫' ? <AppIcon name="delete-left" /> : key}
        </button>
      ))}
    </div>
  )
}

export function applyKey(current: string, key: string): string {
  if (key === '⌫') return current.slice(0, -1)
  const next = `${current}${key}`.replace(/^0+(?=\d)/, '')
  if (next.length > 9) return current
  return next
}

export function amountFromDigits(digits: string): number {
  return digits ? Number(digits) : 0
}
