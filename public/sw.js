/**
 * Cherry Directory — Service Worker
 * Strategy:
 *  - Static assets (JS/CSS/images/fonts) → Cache First
 *  - HTML navigation → Network First, fallback to cache
 *  - API calls (Supabase) → bypass SW (handled by React Query)
 */

const CACHE_NAME = 'cherry-directory-v1'
const STATIC_CACHE = 'cherry-static-v1'

// Assets to pre-cache on install (will be filled after first run)
const PRECACHE_URLS = [
  '/',
  '/index.html',
]

// ── Install ────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...')
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((e) => {
        console.warn('[SW] Precache failed:', e.message)
      })
    })
  )
  self.skipWaiting()
})

// ── Activate ───────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...')
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names
          .filter((n) => n !== CACHE_NAME && n !== STATIC_CACHE)
          .map((n) => {
            console.log('[SW] Deleting old cache:', n)
            return caches.delete(n)
          })
      )
    }).then(() => self.clients.claim())
  )
})

// ── Fetch ─────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // Skip Supabase (let React Query handle)
  if (url.hostname.includes('supabase.co')) return

  // Skip Cloudinary upload endpoints
  if (url.hostname.includes('cloudinary.com') && request.method !== 'GET') return

  // Skip chrome-extension, etc.
  if (!url.protocol.startsWith('http')) return

  // Skip HMR / dev-only endpoints
  if (
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/node_modules') ||
    url.pathname.includes('?t=') ||
    url.searchParams.has('import')
  ) {
    return
  }

  // ── HTML navigation: Network First → Cache fallback ────
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Update cache
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          return response
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || caches.match('/index.html')
          })
        })
    )
    return
  }

  // ── Static assets: Cache First → Network fallback ──────
  const isStatic =
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.ttf') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('unpkg.com')

  if (isStatic) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          // Only cache successful responses
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          }
          return response
        }).catch(() => cached)
      })
    )
    return
  }

  // ── Other: Network with cache fallback ────────────────
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        return response
      })
      .catch(() => caches.match(request))
  )
})

// ── Message handler (for manual cache control) ────────────
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then((names) =>
      Promise.all(names.map((n) => caches.delete(n)))
    )
  }
})
