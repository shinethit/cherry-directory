import { useEffect, useRef } from 'react'

// Leaflet via CDN loaded dynamically — no npm package needed
export default function MapEmbed({ lat, lng, name, address, zoom = 15 }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)

  useEffect(() => {
    if (!lat || !lng || mapInstanceRef.current) return

    // Load Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    // Load Leaflet JS
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => {
      const L = window.L
      if (!mapRef.current || mapInstanceRef.current) return

      const map = L.map(mapRef.current, {
        center: [lat, lng],
        zoom,
        zoomControl: true,
        attributionControl: false,
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

      L.marker([lat, lng], { icon })
        .addTo(map)
        .bindPopup(`<b style="font-family:sans-serif">${name}</b><br><small style="font-family:sans-serif">${address || ''}</small>`)
        .openPopup()

      mapInstanceRef.current = map
    }
    document.head.appendChild(script)

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [lat, lng, name, zoom])

  if (!lat || !lng) return null

  return (
    <div className="space-y-2">
      <div
        ref={mapRef}
        className="w-full h-52 rounded-2xl overflow-hidden border border-white/10"
        style={{ zIndex: 0 }}
      />
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
