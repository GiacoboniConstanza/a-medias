export type TextPart = {
  x: number
  text: string
}

/** Una renglón visual: fragmentos ordenados por x, con la y del renglón. */
export type PdfLine = {
  y: number
  parts: TextPart[]
}

export const Y_TOLERANCE = 3.5

export function lineText(line: PdfLine): string {
  return line.parts
    .map((part) => part.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Para fixtures de texto con layout: cada corrida de no-espacios es un fragmento; x = índice. */
export function linesFromLayout(text: string): PdfLine[] {
  const rows = text.replace(/\r\n/g, '\n').split('\n')
  const lines: PdfLine[] = []
  for (let index = 0; index < rows.length; index += 1) {
    const raw = rows[index] ?? ''
    const parts: TextPart[] = []
    const re = /\S+/g
    let match: RegExpExecArray | null
    while ((match = re.exec(raw))) {
      parts.push({ x: match.index, text: match[0] })
    }
    if (parts.length === 0) continue
    lines.push({ y: -index * 12, parts })
  }
  return lines
}

export function groupPartsIntoLines(items: { x: number; y: number; text: string }[]): PdfLine[] {
  if (items.length === 0) return []
  const ordered = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const lines: PdfLine[] = []
  let current: PdfLine | null = null
  for (const item of ordered) {
    if (!current || Math.abs(current.y - item.y) > Y_TOLERANCE) {
      current = { y: item.y, parts: [{ x: item.x, text: item.text }] }
      lines.push(current)
      continue
    }
    current.parts.push({ x: item.x, text: item.text })
    current.y = (current.y * (current.parts.length - 1) + item.y) / current.parts.length
  }
  for (const line of lines) {
    line.parts.sort((a, b) => a.x - b.x)
  }
  return lines.sort((a, b) => b.y - a.y)
}

/**
 * Agrupa por página (y descendente dentro de cada una) y concatena en orden 1..n.
 * No reordena entre páginas: un sort global por y invertiría el documento.
 */
export function linesFromPageItems(
  pages: readonly { x: number; y: number; text: string }[][],
): PdfLine[] {
  const all: PdfLine[] = []
  for (const items of pages) {
    all.push(...groupPartsIntoLines(items))
  }
  return all
}
