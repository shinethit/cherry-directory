/* Cherry Directory — Service Worker v3 */

const CACHE_VERSION = 'v3'
const CACHE_NAME = 'cherry-directory-' + CACHE_VERSION

function offlineFallback() {
  return new Response('Offline — no cached content', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((n) => n !== CACHE_NAME)
            .map((n) => caches.delete(n))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }

  if (request.method !== 'GET') return
  if (!url.protocol.startsWith('http')) return
  if (url.hostname.includes('supabase.co')) return
  if (url.pathname.startsWith('/@')) return
  if (url.pathname.startsWith('/node_modules')) return
  if (url.searchParams.has('import')) return

  if (
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html')
  ) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone()
            caches
              .open(CACHE_NAME)
              .then((c) => c.put(request, copy))
              .catch(() => {})
          }
          return res
        })
        .catch(async () => {
          const cached = await caches.match(request).catch(() => null)
          if (cached) return cached
          const fallback = await caches.match('/index.html').catch(() => null)
          if (fallback) return fallback
          return offlineFallback()
        })
    )
    return
  }

  const isStatic =
    /\.(js|css|png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf|eot|json)$/i.test(url.pathname) ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('unpkg.com')

  if (isStatic) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request)
          .then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone()
              caches
                .open(CACHE_NAME)
                .then((c) => c.put(request, copy))
                .catch(() => {})
            }
            return res
          })
          .catch(() => offlineFallback())
      })
    )
    return
  }

  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone()
          caches
            .open(CACHE_NAME)
            .then((c) => c.put(request, copy))
            .catch(() => {})
        }
        return res
      })
      .catch(async () => {
        const cached = await caches.match(request).catch(() => null)
        return cached || offlineFallback()
      })
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n))))
  }
})
