import { AppIcon } from './AppIcon.tsx'
import { applyMoneyKey, parseMoneyInput } from '../lib/format.ts'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫']

export function Keypad({ onKey }: { onKey: (key: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onKey(key)}
          className="min-h-12 rounded-2xl bg-card text-center font-display text-[22px] font-semibold text-title shadow-soft"
        >
          {key === '⌫' ? <AppIcon name="delete-left" /> : key}
        </button>
      ))}
    </div>
  )
}

export function applyKey(current: string, key: string): string {
  return applyMoneyKey(current, key)
}

export function amountFromDigits(digits: string): number {
  return parseMoneyInput(digits) ?? 0
}
