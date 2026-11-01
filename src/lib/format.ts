export function money(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function toCents(value: number): number {
  return Math.round(money(value) * 100)
}

export function fromCents(cents: number): number {
  return cents / 100
}

export function normalizeMoney(value: number): number {
  return fromCents(toCents(value))
}

const moneyFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatMoney(value: number): string {
  const amount = money(value)
  const formatted = moneyFormatter.format(Math.abs(amount)).replace(/[\u00a0\u202f]/g, ' ')
  return `${amount < 0 ? '-' : ''}$ ${formatted}`
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`
}

export function parseMoney(raw: string): number | null {
  return parseMoneyInput(raw)
}

export function parseMoneyInput(raw: string): number | null {
  const token = raw.trim().replace(/[$\s\u00a0]/g, '')
  if (!token || token === '-' || token === ',' || token === '.') return null
  const negative = token.startsWith('-')
  const unsigned = negative ? token.slice(1) : token
  if (!unsigned) return null

  let amount: number | null = null
  if (unsigned.includes(',')) {
    if (unsigned.split(',').length > 2) return null
    const [wholeRaw, fracRaw = ''] = unsigned.split(',')
    const whole = Number((wholeRaw || '0').replace(/\./g, ''))
    const fracDigits = fracRaw.replace(/\D/g, '').slice(0, 2)
    const frac = fracDigits === '' ? 0 : Number(fracDigits.padEnd(2, '0'))
    if (!Number.isFinite(whole) || !Number.isFinite(frac)) return null
    amount = whole + frac / 100
  } else if (/^\d+\.\d{1,2}$/.test(unsigned)) {
    amount = Number(unsigned)
  } else if (/^\d{1,3}(\.\d{3})+$/.test(unsigned)) {
    amount = Number(unsigned.replace(/\./g, ''))
  } else if (/^\d+$/.test(unsigned)) {
    amount = Number(unsigned)
  } else {
    return null
  }

  if (amount == null || !Number.isFinite(amount)) return null
  return normalizeMoney(negative ? -amount : amount)
}

export function sanitizeMoneyDraft(raw: string): string {
  const text = raw.replace(/[^\d,.]/g, '')
  if (text.includes(',')) {
    const firstComma = text.indexOf(',')
    const whole = text.slice(0, firstComma).replace(/[.,]/g, '').slice(0, 10)
    const frac = text.slice(firstComma + 1).replace(/\D/g, '').slice(0, 2)
    return `${whole},${frac}`
  }
  if (/^\d+\.\d{1,2}$/.test(text)) return text.replace('.', ',')
  if (/^\d{1,3}(\.\d{3})+$/.test(text)) return text.replace(/\./g, '').slice(0, 10)
  return text.replace(/\./g, '').slice(0, 10)
}

export function applyMoneyKey(current: string, key: string): string {
  if (key === '⌫') return current.slice(0, -1)
  if (key === ',' || key === '.') {
    if (current.includes(',')) return current
    return current === '' ? '0,' : `${current},`
  }
  if (key !== '000' && !/^\d$/.test(key)) return current
  const chunk = key === '000' ? '000' : key
  const comma = current.indexOf(',')
  if (comma >= 0) {
    if (key === '000') return current
    const room = 2 - current.slice(comma + 1).length
    if (room <= 0) return current
    return `${current}${chunk.slice(0, room)}`
  }
  const next = `${current}${chunk}`.replace(/^0+(?=\d)/, '')
  if (next.length > 10) return current
  return next
}

export function moneyDraftFromAmount(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return ''
  const cents = toCents(amount)
  const whole = Math.trunc(Math.abs(cents) / 100)
  const frac = Math.abs(cents) % 100
  if (frac === 0) return String(whole)
  return `${whole},${String(frac).padStart(2, '0')}`
}

export const NOTES_MAX = 500

export function clampNotes(value: string): string | null {
  const trimmed = value.trim().slice(0, NOTES_MAX)
  return trimmed === '' ? null : trimmed
}
