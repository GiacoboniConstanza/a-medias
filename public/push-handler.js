/* Escucha push del PWA: muestra la notificación y al tocar abre la ruta del payload. */
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
      icon: '/icons/icon-192-v3.png',
      badge: '/icons/icon-192-v3.png',
      tag: payload.tag || undefined,
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
          if ('navigate' in client) {
            return client.navigate(target).then((navigated) => (navigated && 'focus' in navigated ? navigated.focus() : client.focus()))
          }
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target)
      return undefined
    }),
  )
})
