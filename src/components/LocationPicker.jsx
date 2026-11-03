import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { X } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default icon paths for Leaflet in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function MapClickHandler({ setLatLng }) {
  useMapEvents({
    click(e) {
      // Select only — do NOT close. The user confirms with the button below.
      setLatLng({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export default function LocationPicker({ onSelect, onClose }) {
  const [position, setPosition] = useState(null);
  const [center, setCenter] = useState({ lat: 20.97, lng: 97.04 }); // Default Taunggyi area

  useEffect(() => {
    // Try to get user's current location for initial map center
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {},
        { timeout: 5000 }
      );
    }
  }, []);

  const handleSelect = (latLng) => {
    setPosition(latLng);
  };

  const handleConfirm = () => {
    if (position) onSelect(position);
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4 pt-safe" onClick={onClose}>
      <div className="bg-[#140020] rounded-2xl w-full max-w-2xl border border-white/10 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b border-white/10">
          <h3 className="font-display font-bold text-white">မြေပုံပေါ်တွင် နေရာရွေးပါ</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="h-96 w-full">
          <MapContainer
            center={center}
            zoom={13}
            style={{ height: '100%', width: '100%', background: '#1a0030' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            {position && <Marker position={[position.lat, position.lng]} />}
            <MapClickHandler setLatLng={handleSelect} />
          </MapContainer>
        </div>
        <div className="p-4 space-y-3">
          {position ? (
            <p className="text-center text-xs text-emerald-400 font-mono">
              {position.lat.toFixed(7)}, {position.lng.toFixed(7)}
            </p>
          ) : (
            <p className="text-center text-white/50 text-xs">
              မြေပုံပေါ်ရှိ နေရာကို နှိပ်ပြီး ရွေးပါ။
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 text-sm font-display font-semibold hover:bg-white/10 transition-colors"
            >
              မလုပ်တော့ပါ
            </button>
            <button
              onClick={handleConfirm}
              disabled={!position}
              className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-display font-semibold hover:bg-brand-500 transition-colors disabled:opacity-50"
            >
              အတည်ပြုမည်
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}