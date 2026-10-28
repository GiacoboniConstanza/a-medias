const SHARE_DB = 'a-medias-share'
const SHARE_STORE = 'pending'
const SHARE_KEY = 'receipt'

export type PendingShare = {
  title: string
  text: string
  url: string
  file: Blob | null
  fileName: string | null
  mime: string | null
}

export function shareReturnPath(value: string | null): string | null {
  if (!value || !value.startsWith('/compartir') || value.startsWith('//')) return null
  if (value.includes('\\') || value.includes('://')) return null
  return value
}

export async function readPendingShare(): Promise<PendingShare | null> {
  const db = await openShareDb()
  const record = await new Promise<PendingShare | undefined>((resolve, reject) => {
    const tx = db.transaction(SHARE_STORE, 'readonly')
    const request = tx.objectStore(SHARE_STORE).get(SHARE_KEY)
    request.onsuccess = () => resolve(request.result as PendingShare | undefined)
    request.onerror = () => reject(request.error)
  })
  db.close()
  if (!record) return null
  return {
    title: typeof record.title === 'string' ? record.title : '',
    text: typeof record.text === 'string' ? record.text : '',
    url: typeof record.url === 'string' ? record.url : '',
    file: record.file instanceof Blob ? record.file : null,
    fileName: typeof record.fileName === 'string' ? record.fileName : null,
    mime: typeof record.mime === 'string' ? record.mime : null,
  }
}

export async function clearPendingShare(): Promise<void> {
  const db = await openShareDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SHARE_STORE, 'readwrite')
    tx.objectStore(SHARE_STORE).delete(SHARE_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

function openShareDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SHARE_DB, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(SHARE_STORE)) db.createObjectStore(SHARE_STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
