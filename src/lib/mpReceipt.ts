export type MpReceipt = {
  amount: number | null
  merchant: string | null
  date: string | null
  confidence: number
}

const MONTHS: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
}

const CATEGORY_HINTS: { category: string; words: string[] }[] = [
  { category: 'Súper', words: ['super', 'supermercado', 'coto', 'carrefour', 'jumbo', 'disco', 'vea', 'dia'] },
  { category: 'Comida', words: ['cafe', 'restaurant', 'resto', 'panaderia', 'kiosco', 'comida', 'pizza', 'heladeria'] },
  { category: 'Viajes', words: ['uber', 'cabify', 'sube', 'ypf', 'shell', 'colectivo', 'peaje'] },
  { category: 'Servicios', words: ['edenor', 'edesur', 'metrogas', 'aysa', 'expensas', 'telecom', 'personal', 'claro', 'internet'] },
  { category: 'Salidas', words: ['cine', 'teatro'] },
  { category: 'Hogar', words: ['easy', 'sodimac', 'ferreteria'] },
]

const MERCHANT_LABELS = ['pagaste a', 'destinatario', 'para'] as const

export function parseMpReceipt(text: string): MpReceipt {
  const amount = readAmount(text)
  const merchant = readMerchant(text)
  const date = readDate(text)
  const found = Number(amount != null) + Number(merchant != null) + Number(date != null)
  return {
    amount,
    merchant,
    date,
    confidence: Math.round((found / 3) * 100) / 100,
  }
}

export function suggestCategoryName(merchant: string | null): string | null {
  if (!merchant) return null
  const folded = fold(merchant)
  for (const hint of CATEGORY_HINTS) {
    if (hint.words.some((word) => hasWord(folded, word))) return hint.category
  }
  return null
}

export function suggestCategoryId(
  merchant: string | null,
  categories: readonly { id: string; name: string }[],
): string | null {
  const wanted = suggestCategoryName(merchant)
  if (!wanted) return null
  const target = fold(wanted)
  return categories.find((category) => fold(category.name) === target)?.id ?? null
}

function readAmount(text: string): number | null {
  const matches = text.match(/\$\s*\d[\d.]*(?:,\d{1,2})?/g)
  if (!matches) return null
  for (const token of matches) {
    const amount = parseArs(token.replace(/\$/g, '').trim())
    if (amount != null && amount > 0) return amount
  }
  return null
}

function parseArs(token: string): number | null {
  if (token.includes(',')) {
    const [whole, frac = ''] = token.split(',')
    const integer = Number(whole.replace(/\./g, ''))
    const decimals = Number(frac.padEnd(2, '0').slice(0, 2))
    if (!Number.isFinite(integer) || !Number.isFinite(decimals)) return null
    return integer + decimals / 100
  }
  if (/^\d{1,3}(\.\d{3})+$/.test(token)) return Number(token.replace(/\./g, ''))
  if (/^\d+\.\d{1,2}$/.test(token)) return Number(token)
  if (/^\d+$/.test(token)) return Number(token)
  return null
}

function readDate(text: string): string | null {
  const long = text.match(/(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de\s+(\d{4})/i)
  if (long) {
    const month = MONTHS[fold(long[2] ?? '')]
    if (month) return isoDate(Number(long[3]), month, Number(long[1]))
  }
  const short = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/)
  if (short) return isoDate(Number(short[3]), Number(short[2]), Number(short[1]))
  return null
}

function isoDate(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const probe = new Date(year, month - 1, day)
  if (probe.getFullYear() !== year || probe.getMonth() !== month - 1 || probe.getDate() !== day) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function readMerchant(text: string): string | null {
  const lines = text.split(/\r?\n/)
  for (const label of MERCHANT_LABELS) {
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]?.trim() ?? ''
      const at = line.toLowerCase().indexOf(label)
      if (at < 0) continue
      if (label === 'para' && at !== 0) continue
      const rest = line.slice(at + label.length).replace(/^[\s:.-]+/, '')
      const sameLine = usableName(rest)
      if (sameLine) return sameLine
      const next = usableName(lines[index + 1] ?? '')
      if (next) return next
    }
  }
  return null
}

function usableName(value: string): string | null {
  const name = value.replace(/\s+/g, ' ').trim()
  if (name.length < 2 || name.length > 60) return null
  if (/^\$/.test(name)) return null
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(name)) return null
  if (/^(importe|monto|fecha|operacion|operación|cuit|cvu|cbu)$/i.test(name)) return null
  return name
}

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

function hasWord(haystack: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`).test(haystack)
}
