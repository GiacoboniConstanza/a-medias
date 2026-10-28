/* Recibe el POST del menú Compartir. Se importa antes de que Workbox registre su fetch. */
const SHARE_DB = 'a-medias-share'
const SHARE_STORE = 'pending'
const SHARE_KEY = 'receipt'
const SHARE_FILE_LIMIT = 12 * 1024 * 1024

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  const path = url.pathname.replace(/\/$/, '') || '/'
  if (event.request.method !== 'POST' || path !== '/compartir') return
  event.stopImmediatePropagation()
  event.respondWith(saveShare(event.request))
})

async function saveShare(request) {
  try {
    const form = await request.formData()
    const file = firstFile(form.getAll('files'))
    await putReceipt({
      title: textField(form, 'title'),
      text: textField(form, 'text'),
      url: textField(form, 'url'),
      file: file && file.size <= SHARE_FILE_LIMIT ? file : null,
      fileName: file ? file.name : null,
      mime: file ? file.type : null,
    })
  } catch {
    // Igual abrimos la pantalla para que el gasto se cargue a mano.
  }
  return Response.redirect(`${self.location.origin}/compartir?pending=1`, 303)
}

function textField(form, name) {
  const value = form.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

function firstFile(parts) {
  for (const part of parts) {
    if (typeof File !== 'undefined' && part instanceof File && part.size > 0) return part
    if (part && typeof part === 'object' && typeof part.size === 'number' && part.size > 0 && typeof part.arrayBuffer === 'function') {
      return part
    }
  }
  return null
}

function openShareDb() {
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

async function putReceipt(record) {
  const db = await openShareDb()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(SHARE_STORE, 'readwrite')
    tx.objectStore(SHARE_STORE).put(record, SHARE_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}
