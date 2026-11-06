/* Cherry Directory — Service Worker v5 */

// v9.23: v14 + install-time skipWaiting — a new worker used to sit in
// "waiting" until every PWA instance closed, so an installed PWA could
// keep running the old worker for days (iOS: the installed Shortcut never
// self-updated). Now it activates at once when the browser's update check
// installs it. (No code can force the check itself — the browser throttles
// it to ~24h — so the error screens still carry the delete-Shortcut
// recovery for an already-installed PWA.)
const CACHE_VERSION = 'v14'
const CACHE_NAME = 'cherry-directory-' + CACHE_VERSION

function offlineFallback() {
  return new Response('Offline — no cached content', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

// v9.18: precache the app shell at install — the navigation fallback
// below used to look up /index.html, but nothing ever put it in the
// cache, so a flaky first visit to e.g. /search?q=upper fell through to
// the synthetic 503. Now the shell is cached on install, so the SPA
// boots and shows its own retry UI instead of a bare 503.
self.addEventListener('install', (event) => {
  // v9.23: activate at once — without this the new worker waits until
  // every client closes, and an installed PWA keeps the old worker.
  self.skipWaiting()
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((c) => c.add('/index.html'))
      .catch(() => {})
  )
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
  // v9.9: same-origin Supabase proxy — API responses must never be SW-cached.
  if (url.pathname.startsWith('/api/supabase')) return
  // v9.22: the version check must always reach the network — a fetch with
  // { cache: 'no-store' } does NOT bypass the SW, and the stale-while-
  // revalidate branch below would serve its cached copy first.
  if (url.pathname === '/version.json') return
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
          // v9.18: the exact search URL (with ?q=…) is only cached if it
          // was visited before — also try the same path without the
          // query, the home shell, and the precached /index.html, so a
          // flaky first visit still boots the SPA instead of a bare 503.
          const noSearch = await caches.match(request, { ignoreSearch: true }).catch(() => null)
          if (noSearch) return noSearch
          const home = await caches.match('/').catch(() => null)
          if (home) return home
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
    // Stale-while-revalidate (C-M1, v9.3): a cache hit used to be returned
    // with no TTL, so old entries survived indefinitely while the cache
    // version was unchanged. Now a hit is served immediately AND refreshed
    // in the background, so the next load gets the fresh copy.
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchAndCache = fetch(request)
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
          .catch(() => null)
        if (cached) {
          event.waitUntil(fetchAndCache)
          return cached
        }
        return fetchAndCache.then((res) => res || offlineFallback())
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
