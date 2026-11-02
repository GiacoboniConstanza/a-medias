import { describe, expect, it } from 'vitest'
import { applyMoneyInput, formatMoneyDraft, padMoneyDraft, parseMoney } from './format.ts'

function caretAt(display: string, valueCount: number): number {
  if (valueCount <= 0) return 0
  let seen = 0
  for (let i = 0; i < display.length; i++) {
    if (/\d/.test(display[i]) || display[i] === ',') {
      seen++
      if (seen === valueCount) return i + 1
    }
  }
  return display.length
}

function type(draft: string, valueCaret: number, key: string) {
  const display = formatMoneyDraft(draft)
  const caret = caretAt(display, valueCaret)
  const raw = `${display.slice(0, caret)}${key}${display.slice(caret)}`
  return applyMoneyInput(draft, raw, caret + key.length)
}

function erase(draft: string, valueCaret: number) {
  const display = formatMoneyDraft(draft)
  const caret = caretAt(display, valueCaret)
  const raw = `${display.slice(0, caret - 1)}${display.slice(caret)}`
  return applyMoneyInput(draft, raw, caret - 1)
}

describe('formateo de montos mientras se escribe', () => {
  it('pone puntos de miles y deja el borrador sin puntos', () => {
    let draft = ''
    for (const digit of '200000') {
      const next = type(draft, draft.length, digit)
      draft = next.draft
    }
    expect(formatMoneyDraft(draft)).toBe('200.000')
    expect(draft).toBe('200000')
    expect(parseMoney(draft)).toBe(200_000)
  })

  it('mantiene el cursor al escribir y borrar en el medio', () => {
    const inserted = type('200000', 1, '5')
    expect(formatMoneyDraft(inserted.draft)).toBe('2.500.000')
    expect(inserted.caret).toBe(caretAt('2.500.000', 2))

    const removed = erase('2500000', 2)
    expect(removed.draft).toBe('200000')
    expect(removed.caret).toBe(caretAt('200.000', 1))
  })

  it('toma la coma y el punto del teclado como decimal, y completa centavos al salir', () => {
    const withComma = type('200000', 6, ',')
    const cents = type(withComma.draft, withComma.draft.length, '5')
    expect(formatMoneyDraft(cents.draft)).toBe('200.000,5')
    expect(padMoneyDraft(cents.draft)).toBe('200000,50')
    expect(parseMoney(padMoneyDraft(cents.draft))).toBe(200_000.5)

    const withDot = type('200000', 6, '.')
    const dotted = type(withDot.draft, withDot.draft.length, '5')
    expect(formatMoneyDraft(dotted.draft)).toBe('200.000,5')
    expect(parseMoney(padMoneyDraft(dotted.draft))).toBe(200_000.5)
  })

  it('pega un monto con miles o solo dígitos', () => {
    const grouped = applyMoneyInput('', '200.000,00', '200.000,00'.length)
    expect(grouped.draft).toBe('200000,00')
    expect(formatMoneyDraft(grouped.draft)).toBe('200.000,00')
    expect(parseMoney(grouped.draft)).toBe(200_000)

    const plain = applyMoneyInput('', '200000', '200000'.length)
    expect(plain.draft).toBe('200000')
    expect(parseMoney(plain.draft)).toBe(200_000)
  })
})
