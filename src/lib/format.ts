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
  return `${amount < 0 ? '-' : ''}$\u00a0${formatted}`
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
const WHOLE_MAX = 10

/** Borrador canónico (sin puntos de miles) con los miles de es-AR, para mostrar mientras se escribe. */
export function formatMoneyDraft(draft: string): string {
  if (!draft) return ''
  const comma = draft.indexOf(',')
  const whole = (comma >= 0 ? draft.slice(0, comma) : draft).replace(/\D/g, '')
  const grouped = groupThousands(whole)
  if (comma < 0) return grouped
  const frac = draft.slice(comma + 1).replace(/\D/g, '').slice(0, 2)
  return `${grouped},${frac}`
}

/** Al salir del campo, completa los centavos si ya había coma. */
export function padMoneyDraft(draft: string): string {
  if (!draft.includes(',')) return draft
  const [whole, frac = ''] = draft.split(',')
  return `${whole},${frac.replace(/\D/g, '').padEnd(2, '0').slice(0, 2)}`
}

/**
 * Aplica lo que llegó del input (tecleo, borrado o pegado) y devuelve el borrador
 * canónico más la posición del cursor sobre el texto con puntos de miles.
 */
export function applyMoneyInput(previousDraft: string, raw: string, caret: number): { draft: string; caret: number } {
  const previousDisplay = formatMoneyDraft(previousDraft)
  const { text } = stripMoneyChrome(raw, caret)
  const previous = stripMoneyChrome(previousDisplay, previousDisplay.length).text
  const change = textChange(previous, text)
  const draft = change ? editMoneyDraft(previousDraft, previous, change) : sanitizeMoneyDraft(text)
  const display = formatMoneyDraft(draft)
  const valueCaret = change ? caretAfterEdit(previousDraft, draft, previous, change) : valueCharsBefore(display, display.length)
  return { draft, caret: caretFromValueChars(display, valueCaret) }
}

function groupThousands(whole: string): string {
  if (!whole) return ''
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function stripMoneyChrome(raw: string, caret: number): { text: string; caret: number } {
  let text = ''
  let next = 0
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (ch === '$' || ch === ' ' || ch === '\u00a0' || ch === '\u202f') continue
    text += ch
    if (i < caret) next++
  }
  return { text, caret: next }
}

function textChange(previous: string, next: string): { start: number; deleted: string; inserted: string } | null {
  let start = 0
  while (start < previous.length && start < next.length && previous[start] === next[start]) start++
  let endPrev = previous.length - 1
  let endNext = next.length - 1
  while (endPrev >= start && endNext >= start && previous[endPrev] === next[endNext]) {
    endPrev--
    endNext--
  }
  const deleted = previous.slice(start, endPrev + 1)
  const inserted = next.slice(start, endNext + 1)
  if (!deleted && !inserted) return null
  return { start, deleted, inserted }
}

function editMoneyDraft(
  previousDraft: string,
  previousDisplay: string,
  change: { start: number; deleted: string; inserted: string },
): string {
  const { start, deleted, inserted } = change
  const at = valueCharsBefore(previousDisplay, start)
  if (inserted.length === 1 && deleted.length === 0 && /^\d$/.test(inserted)) {
    return insertDigit(previousDraft, at, inserted)
  }
  if (inserted.length === 1 && deleted.length === 0 && (inserted === ',' || inserted === '.')) {
    return insertDecimal(previousDraft, at)
  }
  if (inserted.length === 0 && deleted.length > 0) {
    const from = deleted === '.' ? Math.max(0, at - 1) : at
    const count = Math.max(1, valueCharsBefore(deleted, deleted.length))
    return previousDraft.slice(0, from) + previousDraft.slice(from + count)
  }
  if (inserted.length === 1 && deleted.length === 1 && /^\d$/.test(inserted)) {
    const without = previousDraft.slice(0, at) + previousDraft.slice(at + valueCharsBefore(deleted, deleted.length))
    return insertDigit(without, at, inserted)
  }
  return sanitizeMoneyDraft(previousDisplay.slice(0, start) + inserted + previousDisplay.slice(start + deleted.length))
}

function insertDigit(draft: string, at: number, digit: string): string {
  const comma = draft.indexOf(',')
  if (comma >= 0 && at > comma) {
    const frac = draft.slice(comma + 1)
    if (frac.length >= 2) return draft
  } else {
    const whole = comma >= 0 ? draft.slice(0, comma) : draft
    if (whole.length >= WHOLE_MAX) return draft
  }
  const next = `${draft.slice(0, at)}${digit}${draft.slice(at)}`.replace(/^0+(?=\d)/, '')
  return next
}

function insertDecimal(draft: string, at: number): string {
  if (draft.includes(',')) return draft
  const index = Math.min(at, draft.length)
  const whole = draft.slice(0, index)
  const frac = draft.slice(index, index + 2)
  return `${whole || '0'},${frac}`
}

function caretAfterEdit(
  previousDraft: string,
  draft: string,
  previousDisplay: string,
  change: { start: number; deleted: string; inserted: string },
): number {
  const at = valueCharsBefore(previousDisplay, change.start)
  if (draft === previousDraft) return at
  if (change.inserted.length === 0) {
    return change.deleted === '.' ? Math.max(0, at - 1) : at
  }
  if (change.inserted === ',' || change.inserted === '.') {
    const comma = draft.indexOf(',')
    return comma >= 0 ? comma + 1 : draft.length
  }
  if (/^\d$/.test(change.inserted) && change.deleted.length === 0) return at + 1
  return draft.length
}

function valueCharsBefore(text: string, index: number): number {
  let count = 0
  const end = Math.max(0, Math.min(index, text.length))
  for (let i = 0; i < end; i++) {
    if (/\d/.test(text[i]) || text[i] === ',') count++
  }
  return count
}

function caretFromValueChars(display: string, count: number): number {
  if (count <= 0) return 0
  let seen = 0
  for (let i = 0; i < display.length; i++) {
    if (/\d/.test(display[i]) || display[i] === ',') {
      seen++
      if (seen === count) return i + 1
    }
  }
  return display.length
}

export function moneyDraftFromAmount(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return ''
  const cents = toCents(amount)
  const whole = Math.trunc(Math.abs(cents) / 100)
  const frac = Math.abs(cents) % 100
  if (frac === 0) return String(whole)
  return `${whole},${String(frac).padStart(2, '0')}`
}

export function amountFromDigits(digits: string): number {
  return parseMoneyInput(digits) ?? 0
}

export const NOTES_MAX = 500

export function clampNotes(value: string): string | null {
  const trimmed = value.trim().slice(0, NOTES_MAX)
  return trimmed === '' ? null : trimmed
}
