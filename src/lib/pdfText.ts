import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { groupPartsIntoLines, lineText, type PdfLine } from './pdfLines.ts'

export type { PdfLine, TextPart } from './pdfLines.ts'
export { lineText, linesFromLayout } from './pdfLines.ts'

GlobalWorkerOptions.workerSrc = workerSrc

export async function pdfText(file: Blob): Promise<string> {
  const lines = await pdfPositionedLines(file)
  return lines
    .map((line) => lineText(line))
    .filter(Boolean)
    .join('\n')
}

/** Extrae renglones agrupando ítems por y (tolerancia) y ordenándolos por x. */
export async function pdfPositionedLines(file: Blob): Promise<PdfLine[]> {
  const data = new Uint8Array(await file.arrayBuffer())
  const task = getDocument({ data })
  const doc = await task.promise
  const all: PdfLine[] = []
  try {
    let yOffset = 0
    for (let number = 1; number <= doc.numPages; number += 1) {
      const page = await doc.getPage(number)
      const viewport = page.getViewport({ scale: 1 })
      const content = await page.getTextContent()
      const items: { x: number; y: number; text: string }[] = []
      for (const item of content.items) {
        if (!('str' in item) || !item.str) continue
        const transform = 'transform' in item ? item.transform : null
        if (!transform) continue
        const x = Number(transform[4])
        const y = Number(transform[5])
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue
        items.push({ x, y: y + yOffset, text: item.str })
      }
      all.push(...groupPartsIntoLines(items))
      yOffset += viewport.height + 40
    }
  } finally {
    await task.destroy()
  }
  return all.sort((a, b) => b.y - a.y)
}
