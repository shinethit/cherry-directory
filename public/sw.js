const CACHE_NAME = 'cherry-dir-v5'
const STATIC_CACHE = 'cherry-static-v5'

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
  '/favicon.png',
  '/apple-touch-icon.png',
  '/icons/icon-72.png',
  '/icons/icon-96.png',
  '/icons/icon-128.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

// Activate: DELETE ALL old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET') return
  if (url.protocol === 'chrome-extension:') return

  if (url.hostname.includes('supabase.co') || url.hostname.includes('cloudinary.com')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
          return response
        })
        .catch(() => caches.match(event.request))
    )
    return
  }

  // JS/CSS assets — network first (always get latest)
  if (url.pathname.includes('/assets/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone()
          caches.open(STATIC_CACHE).then(cache => cache.put(event.request, clone))
          return response
        })
        .catch(() => caches.match(event.request))
    )
    return
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response
        const clone = response.clone()
        caches.open(STATIC_CACHE).then(cache => cache.put(event.request, clone))
        return response
      })
      .catch(() => caches.match(event.request) || caches.match('/'))
  )
})

self.addEventListener('push', event => {
  const data = event.data?.json() || {}
  const options = {
    body: data.body || 'Cherry Directory မှ အကြောင်းကြားချက်',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-96.png',
    tag: data.tag || 'cherry-dir',
    data: { url: data.url || '/' },
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Cherry Directory 🍒', options)
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  if (event.action === 'dismiss') return
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
