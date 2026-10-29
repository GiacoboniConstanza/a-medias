import { createWorker } from 'tesseract.js'

export async function ocrImage(file: Blob): Promise<string> {
  const worker = await createWorker('spa')
  const url = URL.createObjectURL(file)
  try {
    const result = await worker.recognize(url)
    return result.data.text ?? ''
  } finally {
    URL.revokeObjectURL(url)
    await worker.terminate()
  }
}
