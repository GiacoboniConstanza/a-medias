import { fold, parseArs } from './mpReceipt.ts'
import { lineText, type PdfLine } from './pdfLines.ts'

export type MpParsedMove = {
  date: string
  operationId: string
  /** Con signo: negativo = salida, positivo = entrada. */
  amount: number
  balance: number
  description: string
}

export type MpMerchantPref = {
  merchantKey: string
  categoryId: string | null
  isShared: boolean
}

export type MpClassifyInput = {
  partnerAliases: readonly string[]
  merchantPrefs: readonly MpMerchantPref[]
  importedIds: ReadonlySet<string>
}

export type MpRowKind = 'expense' | 'income' | 'transfer' | 'notice' | 'hidden'

export type MpClassifiedRow = {
  operationId: string
  date: string
  /** Monto absoluto (> 0). */
  amount: number
  signedAmount: number
  description: string
  kind: MpRowKind
  /** Si conviene venir tildada en la UI. */
  checked: boolean
  title: string
  merchantKey: string | null
  categoryId: string | null
  isShared: boolean
  transferDirection: 'sent' | 'received' | null
  counterpartName: string | null
  /** Aviso fijo Créditos MP. */
  creditoMp: boolean
  status: 'ready' | 'already_imported' | 'refund_pair' | 'refund_notice' | 'needs_partner_alias'
  statusLabel: string | null
}

export type MpClassifyResult = {
  rows: MpClassifiedRow[]
  unrecognizedTransferNames: string[]
}

const DATE_RE = /\b(\d{2})-(\d{2})-(\d{4})\b/
const OP_ID_RE = /\b(\d{10,13})\b/
const MONEY_RE = /\$\s*-?\s*[\d.]+(?:,\d{1,2})?/g
const PAGE_RE = /^\d{1,2}\/\d{1,2}$/
const HEADER_WORDS = new Set(
  ['fecha', 'descripcion', 'descripción', 'id', 'de', 'la', 'operacion', 'operación', 'valor', 'saldo'].map(fold),
)

/** Parsea el bloque DETALLE DE MOVIMIENTOS a filas ancla con descripción reunida. */
export function parseMpStatement(lines: readonly PdfLine[]): MpParsedMove[] {
  const start = lines.findIndex((line) => /detalle de movimientos/i.test(lineText(line)))
  if (start < 0) return []
  let end = lines.findIndex(
    (line, index) =>
      index > start &&
      (/resumen de tenencias en d[oó]lares/i.test(lineText(line)) || /fecha de generaci[oó]n/i.test(lineText(line))),
  )
  if (end < 0) end = lines.length
  const body = lines.slice(start + 1, end).filter((line) => !isNoiseLine(line))
  const columns = detectColumns(body)
  const anchors: { index: number; anchor: Anchor }[] = []
  for (let index = 0; index < body.length; index += 1) {
    const anchor = readAnchor(body[index]!, columns)
    if (anchor) anchors.push({ index, anchor })
  }

  return anchors.map((entry, order) => {
    const prevIndex = order > 0 ? anchors[order - 1]!.index : -1
    const nextIndex = order + 1 < anchors.length ? anchors[order + 1]!.index : body.length
    const description = gatherDescription(body, entry.index, prevIndex, nextIndex, entry.anchor)
    return {
      date: entry.anchor.date,
      operationId: entry.anchor.operationId,
      amount: entry.anchor.amount,
      balance: entry.anchor.balance,
      description,
    }
  })
}

export function classifyMpMoves(
  moves: readonly MpParsedMove[],
  input: MpClassifyInput,
): MpClassifyResult {
  const aliasKeys = new Set(input.partnerAliases.map((name) => foldMerchant(name)).filter(Boolean))
  const prefByKey = new Map(input.merchantPrefs.map((pref) => [pref.merchantKey, pref]))
  const refundIds = new Set<string>()

  for (const move of moves) {
    if (describeKind(move.description).type === 'refund') refundIds.add(move.operationId)
  }

  const unrecognized: string[] = []
  const rows: MpClassifiedRow[] = []

  for (const move of moves) {
    const kind = describeKind(move.description)
    const amount = Math.abs(move.amount)
    const base = {
      operationId: move.operationId,
      date: move.date,
      amount,
      signedAmount: move.amount,
      description: move.description,
      merchantKey: null as string | null,
      categoryId: null as string | null,
      isShared: true,
      transferDirection: null as 'sent' | 'received' | null,
      counterpartName: null as string | null,
      creditoMp: false,
      statusLabel: null as string | null,
    }

    if (kind.type === 'refund') {
      const pairPayment = moves.find(
        (row) =>
          row.operationId === move.operationId &&
          row !== move &&
          (describeKind(row.description).type === 'qr' || describeKind(row.description).type === 'pago'),
      )
      if (pairPayment) {
        rows.push({
          ...base,
          kind: 'hidden',
          checked: false,
          title: kind.merchant,
          status: 'refund_pair',
          statusLabel: null,
        })
        continue
      }
      rows.push({
        ...base,
        kind: 'notice',
        checked: false,
        title: `Devolución de pago ${kind.merchant}`,
        status: 'refund_notice',
        statusLabel: input.importedIds.has(move.operationId)
          ? 'Devolución de un pago ya cargado'
          : 'Devolución sin el pago en este archivo',
      })
      continue
    }

    if ((kind.type === 'qr' || kind.type === 'pago') && refundIds.has(move.operationId)) {
      const refund = moves.find(
        (row) => row.operationId === move.operationId && describeKind(row.description).type === 'refund',
      )
      if (refund) {
        rows.push({
          ...base,
          kind: 'hidden',
          checked: false,
          title: kind.merchant,
          status: 'refund_pair',
          statusLabel: null,
        })
        continue
      }
    }

    if (input.importedIds.has(move.operationId)) {
      rows.push({
        ...base,
        kind: 'notice',
        checked: false,
        title: move.description,
        status: 'already_imported',
        statusLabel: 'Ya está cargado',
      })
      continue
    }

    if (kind.type === 'qr' || kind.type === 'pago') {
      const merchantKey = foldMerchant(kind.merchant)
      const pref = prefByKey.get(merchantKey)
      rows.push({
        ...base,
        kind: 'expense',
        checked: true,
        title: kind.merchant,
        merchantKey,
        categoryId: pref?.categoryId ?? null,
        isShared: pref?.isShared ?? true,
        status: 'ready',
      })
      continue
    }

    if (kind.type === 'transfer') {
      const counterpartName = kind.name
      const key = foldMerchant(counterpartName)
      const isPartner = aliasKeys.has(key)
      if (isPartner) {
        rows.push({
          ...base,
          kind: 'transfer',
          checked: true,
          title: counterpartName,
          counterpartName,
          transferDirection: kind.direction,
          isShared: false,
          status: 'ready',
        })
        continue
      }
      if (key && !unrecognized.includes(counterpartName)) unrecognized.push(counterpartName)
      if (kind.direction === 'sent') {
        rows.push({
          ...base,
          kind: 'expense',
          checked: false,
          title: counterpartName,
          counterpartName,
          transferDirection: 'sent',
          isShared: false,
          status: 'needs_partner_alias',
          statusLabel: 'Transferencia a otra persona',
        })
      } else {
        rows.push({
          ...base,
          kind: 'income',
          checked: false,
          title: counterpartName,
          counterpartName,
          transferDirection: 'received',
          isShared: false,
          status: 'needs_partner_alias',
          statusLabel: 'Transferencia de otra persona',
        })
      }
      continue
    }

    if (kind.type === 'credito_mp') {
      rows.push({
        ...base,
        kind: 'expense',
        checked: true,
        title: 'Créditos Mercado Pago',
        isShared: false,
        creditoMp: true,
        status: 'ready',
      })
      continue
    }

    if (kind.type === 'rendimientos') {
      rows.push({
        ...base,
        kind: 'income',
        checked: false,
        title: 'Rendimientos',
        isShared: false,
        status: 'ready',
      })
      continue
    }

    rows.push({
      ...base,
      kind: move.amount < 0 ? 'expense' : 'income',
      checked: false,
      title: move.description || 'Movimiento Mercado Pago',
      isShared: false,
      status: 'ready',
    })
  }

  return {
    rows: rows.filter((row) => row.kind !== 'hidden'),
    unrecognizedTransferNames: unrecognized,
  }
}

export function foldMerchant(value: string): string {
  return fold(value).replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')
}

type Columns = {
  fecha: number
  descripcion: number
  operacion: number
  valor: number
  saldo: number
}

type Anchor = {
  date: string
  operationId: string
  amount: number
  balance: number
  descParts: string[]
}

function detectColumns(lines: readonly PdfLine[]): Columns {
  for (const line of lines.slice(0, 12)) {
    const fecha = line.parts.find((part) => fold(part.text) === 'fecha')
    const valor = line.parts.find((part) => fold(part.text) === 'valor')
    const saldo = line.parts.find((part) => fold(part.text) === 'saldo')
    const id = line.parts.find((part) => fold(part.text) === 'id' || fold(part.text).startsWith('operacion') || fold(part.text).startsWith('operación'))
    if (fecha && valor && saldo) {
      return {
        fecha: fecha.x,
        descripcion: fecha.x + 12,
        operacion: id?.x ?? valor.x - 20,
        valor: valor.x,
        saldo: saldo.x,
      }
    }
  }
  return { fecha: 0, descripcion: 12, operacion: 40, valor: 55, saldo: 70 }
}

function isNoiseLine(line: PdfLine): boolean {
  const text = lineText(line)
  if (!text) return true
  if (PAGE_RE.test(text)) return true
  const words = text.split(/\s+/).map(fold)
  if (words.every((word) => HEADER_WORDS.has(word))) return true
  if (/^id de la$/i.test(text) || /^operaci[oó]n$/i.test(text)) return true
  if (/detalle de movimientos/i.test(text)) return true
  return false
}

function readAnchor(line: PdfLine, columns: Columns): Anchor | null {
  const text = lineText(line)
  const dateMatch = text.match(DATE_RE)
  if (!dateMatch) return null
  const iso = toIso(dateMatch[1]!, dateMatch[2]!, dateMatch[3]!)
  if (!iso) return null

  const moneyTokens = [...text.matchAll(MONEY_RE)].map((match) => match[0])
  if (moneyTokens.length < 2) return null
  const amount = parseArs(moneyTokens[moneyTokens.length - 2] ?? '')
  const balance = parseArs(moneyTokens[moneyTokens.length - 1] ?? '')
  if (amount == null || balance == null) return null

  const opIds = [...text.matchAll(new RegExp(OP_ID_RE.source, 'g'))].map((match) => match[1]!).filter(Boolean)
  // El ID no debe ser un trozo de un monto parseado: preferimos el que cae cerca de la columna operación.
  let operationId = pickOperationId(line, columns, opIds)
  if (!operationId) return null

  // Descripción = textos entre la fecha y el ID de operación (o el valor, si el ID está muy a la derecha).
  const datePart = line.parts.find((part) => DATE_RE.test(part.text))
  const idPart = line.parts.find((part) => part.text === operationId)
  const valorX = idPart?.x ?? columns.valor
  const descParts = line.parts
    .filter((part) => {
      if (DATE_RE.test(part.text) || part.text === operationId || part.text.includes('$')) return false
      if (datePart && part.x <= datePart.x) return false
      if (part.x >= valorX) return false
      return true
    })
    .map((part) => part.text)

  return { date: iso, operationId, amount, balance, descParts }
}

function pickOperationId(line: PdfLine, columns: Columns, candidates: string[]): string | null {
  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0]!
  let best: string | null = null
  let bestDist = Number.POSITIVE_INFINITY
  for (const part of line.parts) {
    if (!OP_ID_RE.test(part.text)) continue
    const id = part.text.match(OP_ID_RE)?.[1]
    if (!id || !candidates.includes(id)) continue
    const dist = Math.abs(part.x - columns.operacion)
    if (dist < bestDist) {
      best = id
      bestDist = dist
    }
  }
  return best ?? candidates[0] ?? null
}

function gatherDescription(
  body: readonly PdfLine[],
  anchorIndex: number,
  prevAnchorIndex: number,
  nextAnchorIndex: number,
  anchor: Anchor,
): string {
  const chunks: { y: number; text: string }[] = []
  const anchorLine = body[anchorIndex]!
  for (const part of anchor.descParts) {
    if (part.trim()) chunks.push({ y: anchorLine.y, text: part.trim() })
  }

  for (let index = prevAnchorIndex + 1; index < nextAnchorIndex; index += 1) {
    if (index === anchorIndex) continue
    const line = body[index]
    if (!line) continue
    if (isNoiseLine(line)) continue
    const text = lineText(line)
    if (!text || DATE_RE.test(text) || PAGE_RE.test(text) || text.includes('$')) continue
    if (OP_ID_RE.test(text) && !/[a-záéíóúñ]/i.test(text)) continue
    const cleaned = text.replace(/\s+/g, ' ').trim()
    const startsMove = looksLikeDescriptionStart(cleaned)
    // Entre A y B: si parece inicio de movimiento, es de B; si no, continuación de A.
    if (index > anchorIndex && startsMove) continue
    if (index < anchorIndex && !startsMove) continue
    chunks.push({ y: line.y, text: cleaned })
  }

  chunks.sort((a, b) => b.y - a.y)
  return chunks
    .map((chunk) => chunk.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function toIso(day: string, month: string, year: string): string | null {
  const d = Number(day)
  const m = Number(month)
  const y = Number(year)
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) return null
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const probe = new Date(y, m - 1, d)
  if (probe.getFullYear() !== y || probe.getMonth() !== m - 1 || probe.getDate() !== d) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

type DescKind =
  | { type: 'qr'; merchant: string }
  | { type: 'pago'; merchant: string }
  | { type: 'refund'; merchant: string }
  | { type: 'transfer'; direction: 'sent' | 'received'; name: string }
  | { type: 'credito_mp' }
  | { type: 'rendimientos' }
  | { type: 'other' }

function describeKind(description: string): DescKind {
  const text = description.replace(/\s+/g, ' ').trim()
  const folded = fold(text)
  if (/^rendimientos\b/.test(folded)) return { type: 'rendimientos' }
  if (/debito por deuda creditos de mercado pago/.test(folded)) return { type: 'credito_mp' }

  const refund = text.match(/^devoluci[oó]n de pago(?:\s+(.+))?$/i)
  if (refund) return { type: 'refund', merchant: (refund[1] ?? '').trim() || 'pago' }

  const qr = text.match(/^pago con qr\s+(.+)$/i)
  if (qr?.[1]) return { type: 'qr', merchant: qr[1].trim() }

  const pago = text.match(/^pago\s+(.+)$/i)
  if (pago?.[1] && !/^con qr\b/i.test(pago[1])) return { type: 'pago', merchant: pago[1].trim() }

  const transfer = text.match(/^transferencia\s+(enviada|recibida)\s+(.+)$/i)
  if (transfer?.[1] && transfer[2]) {
    return {
      type: 'transfer',
      direction: fold(transfer[1]) === 'enviada' ? 'sent' : 'received',
      name: transfer[2].trim(),
    }
  }
  return { type: 'other' }
}

function looksLikeDescriptionStart(text: string): boolean {
  return /^(pago|transferencia|d[eé]bito|devoluci[oó]n|rendimientos)\b/i.test(text.trim())
}
