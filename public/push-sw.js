/* eslint-disable no-undef */
/**
 * Push handlers for the PWA service worker.
 *
 * Pulled into the generated Workbox service worker via `workbox.importScripts`
 * in nuxt.config.ts. It lives in public/ as plain JS (not app/ TypeScript)
 * because it runs in the service worker scope, which has no bundler pass and
 * no access to app code.
 *
 * Payloads come from server/utils/push.ts and look like:
 *   { title, body, url?, tag? }
 */

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  }
  catch {
    // A push with a non-JSON body still deserves to surface rather than be
    // dropped silently — browsers may show a generic "site updated in the
    // background" notice otherwise.
    payload = { title: 'Abide Connect', body: event.data ? event.data.text() : '' }
  }

  const title = payload.title || 'Abide Connect'

  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: payload.tag || undefined,
      data: { url: payload.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Reuse an already-open window where possible so tapping a notification
      // doesn't stack up duplicate PWA windows.
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(url)
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    }),
  )
})
