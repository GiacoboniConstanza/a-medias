import type { PendingShare } from './shareInbox.ts'

export async function extractShareText(share: PendingShare): Promise<string> {
  const intro = [share.title, share.text, share.url].filter(Boolean).join('\n')
  if (!share.file) return intro
  const mime = (share.mime || share.file.type || '').toLowerCase()
  const name = share.fileName?.toLowerCase() ?? ''
  try {
    if (mime.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/.test(name)) {
      const { ocrImage } = await import('./ocrImage.ts')
      return joinText(intro, await ocrImage(share.file))
    }
    if (mime === 'application/pdf' || name.endsWith('.pdf')) {
      const { pdfText } = await import('./pdfText.ts')
      return joinText(intro, await pdfText(share.file))
    }
    if (mime.startsWith('text/') || name.endsWith('.txt')) {
      return joinText(intro, await share.file.text())
    }
  } catch {
    return intro
  }
  return intro
}

function joinText(intro: string, extra: string): string {
  const body = extra.trim()
  if (!intro) return body
  if (!body) return intro
  return `${intro}\n${body}`
}
