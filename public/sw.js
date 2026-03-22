const CACHE_NAME = 'cherry-dir-v3'
const STATIC_CACHE = 'cherry-static-v3'

// Static assets to pre-cache
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

// Install: pre-cache static shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME && k !== STATIC_CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch: network-first for API, cache-first for static
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  // Skip non-GET and chrome-extension
  if (event.request.method !== 'GET') return
  if (url.protocol === 'chrome-extension:') return

  // Supabase API — network first, fall back to cache
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

  // Static assets — cache first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response
        const clone = response.clone()
        caches.open(STATIC_CACHE).then(cache => cache.put(event.request, clone))
        return response
      })
    }).catch(() => caches.match('/'))
  )
})

// Push notifications
self.addEventListener('push', event => {
  const data = event.data?.json() || {}
  const options = {
    body: data.body || 'Cherry Directory မှ အကြောင်းကြားချက်',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-96.png',
    tag: data.tag || 'cherry-dir',
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: 'ဖွင့်ကြည့်မယ်' },
      { action: 'dismiss', title: 'ပိတ်မယ်' },
    ],
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
