import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerSrc

export async function pdfText(file: Blob): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer())
  const task = getDocument({ data })
  const doc = await task.promise
  const pages: string[] = []
  try {
    for (let number = 1; number <= doc.numPages; number += 1) {
      const page = await doc.getPage(number)
      const content = await page.getTextContent()
      const line = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (line) pages.push(line)
    }
  } finally {
    await task.destroy()
  }
  return pages.join('\n')
}
