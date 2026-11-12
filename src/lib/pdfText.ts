import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { lineText, linesFromPageItems, type PdfLine } from './pdfLines.ts'

export type { PdfLine, TextPart } from './pdfLines.ts'
export { lineText, linesFromLayout, linesFromPageItems } from './pdfLines.ts'

GlobalWorkerOptions.workerSrc = workerSrc

export async function pdfText(file: Blob): Promise<string> {
  const lines = await pdfPositionedLines(file)
  return lines
    .map((line) => lineText(line))
    .filter(Boolean)
    .join('\n')
}

/** Extrae renglones por página (y↓, x→) y concatena en orden de lectura 1..n. */
export async function pdfPositionedLines(file: Blob): Promise<PdfLine[]> {
  const data = new Uint8Array(await file.arrayBuffer())
  const task = getDocument({ data })
  const doc = await task.promise
  const pages: { x: number; y: number; text: string }[][] = []
  try {
    for (let number = 1; number <= doc.numPages; number += 1) {
      const page = await doc.getPage(number)
      const content = await page.getTextContent()
      const items: { x: number; y: number; text: string }[] = []
      for (const item of content.items) {
        if (!('str' in item) || !item.str) continue
        const transform = 'transform' in item ? item.transform : null
        if (!transform) continue
        const x = Number(transform[4])
        const y = Number(transform[5])
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue
        items.push({ x, y, text: item.str })
      }
      pages.push(items)
    }
  } finally {
    await task.destroy()
  }
  return linesFromPageItems(pages)
}
