import { useEffect, useRef, useState } from 'react'

// Leaflet via CDN loaded dynamically — no npm package needed
export default function MapEmbed({ lat, lng, name, address, zoom = 15 }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markerRef = useRef(null)
  const [leafletReady, setLeafletReady] = useState(!!window.L)
  const [loadError, setLoadError] = useState(false)

  // Load Leaflet (once). A failed CDN load shows a real error state instead
  // of a silently empty box.
  useEffect(() => {
    if (window.L) { setLeafletReady(true); return }

    // Load Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    const existing = document.querySelector('script[src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"]')
    if (existing) {
      existing.addEventListener('load', () => setLeafletReady(true))
      existing.addEventListener('error', () => setLoadError(true))
      return
    }

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => setLeafletReady(true)
    script.onerror = () => setLoadError(true)
    document.head.appendChild(script)
  }, [])

  // Popup content built with textContent — never raw HTML interpolation of
  // the listing name/address.
  function popupEl() {
    const d = document.createElement('div')
    const b = document.createElement('b')
    b.style.fontFamily = 'sans-serif'
    b.textContent = name || ''
    d.appendChild(b)
    if (address) {
      d.appendChild(document.createElement('br'))
      const s = document.createElement('small')
      s.style.fontFamily = 'sans-serif'
      s.textContent = address
      d.appendChild(s)
    }
    return d
  }

  // Create the map once (not once per navigation).
  useEffect(() => {
    if (!leafletReady || !lat || !lng || !mapRef.current || mapInstanceRef.current) return
    const L = window.L
    if (!L) return

    const map = L.map(mapRef.current, {
      center: [lat, lng],
      zoom,
      zoomControl: true,
      attributionControl: true, // OSM attribution must stay visible
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map)

    // Custom cherry marker
    const icon = L.divIcon({
      html: `<div style="font-size:28px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));">🍒</div>`,
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    })

    const marker = L.marker([lat, lng], { icon }).addTo(map)
    markerRef.current = marker
    // B32: do NOT auto-open the popup — it covers the map. It opens on
    // marker tap instead.
    marker.bindPopup(popupEl())

    mapInstanceRef.current = map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leafletReady, lat, lng])

  // Re-centre + move the pin when navigating :id → :other-id (the old code
  // returned early once a map existed, so the pin stayed on the first listing).
  useEffect(() => {
    const map = mapInstanceRef.current
    const marker = markerRef.current
    if (!map || !lat || !lng) return
    map.setView([lat, lng], map.getZoom())
    if (marker) {
      marker.setLatLng([lat, lng])
      const popup = marker.getPopup()
      if (popup) popup.setContent(popupEl())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, name, address])

  // Tear down on unmount only.
  useEffect(() => () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove()
      mapInstanceRef.current = null
      markerRef.current = null
    }
  }, [])

  if (!lat || !lng) return null

  return (
    <div className="space-y-2">
      {loadError ? (
        <div className="w-full h-52 rounded-2xl overflow-hidden border border-red-500/30 bg-red-500/5 flex items-center justify-center p-4 text-center">
          <p className="text-xs text-red-400 font-myanmar">မြေပုံ တင်မရပါ — အောက်က Google Maps လင့်ခ်ဖြင့် ကြည့်နိုင်သည်</p>
        </div>
      ) : (
        <div
          ref={mapRef}
          className="w-full h-52 rounded-2xl overflow-hidden border border-white/10"
          style={{ zIndex: 0 }}
        />
      )}
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white/60 hover:bg-white/8 hover:text-white/80 transition-colors"
      >
        🗺️ Google Maps တွင် ဖွင့်ကြည့်မည်
      </a>
    </div>
  )
}
