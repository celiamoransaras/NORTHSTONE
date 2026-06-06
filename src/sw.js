import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

// Precache assets generados por Vite
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// ---- Push notifications ----
self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'Northstone', body: event.data.text() }
  }

  const { title = 'Northstone', body = '', url = '/', icon = '/icon-192.png', badge = '/icon-192.png' } = payload

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      data: { url },
      vibrate: [100, 50, 100],
      requireInteraction: false,
    })
  )
})

// ---- Abrir la app al tocar la notificación ----
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Si la app ya está abierta, enfocamos esa ventana
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      // Si no, abrimos una ventana nueva
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
