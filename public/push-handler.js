/* Escucha push del PWA. No envía nada: solo muestra lo que llegue si algún día hay un emisor. */
self.addEventListener('push', (event) => {
  const fallback = {
    title: 'A Medias',
    body: 'Tenés un aviso.',
    url: '/recordatorios',
  }
  let payload = fallback
  try {
    if (event.data) payload = { ...fallback, ...event.data.json() }
  } catch {
    payload = { ...fallback, body: event.data ? event.data.text() : fallback.body }
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icons/icon-192-v2.png',
      badge: '/icons/icon-192-v2.png',
      data: { url: payload.url || '/recordatorios' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/recordatorios'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ('focus' in client) {
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target)
      return undefined
    }),
  )
})
