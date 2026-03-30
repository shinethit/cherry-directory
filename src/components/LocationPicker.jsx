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

function MapClickHandler({ setLatLng, onClose }) {
  useMapEvents({
    click(e) {
      setLatLng({ lat: e.latlng.lat, lng: e.latlng.lng });
      onClose();
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
    onSelect(latLng);
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
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
            <MapClickHandler setLatLng={handleSelect} onClose={onClose} />
          </MapContainer>
        </div>
        <div className="p-4 text-center text-white/50 text-xs">
          မြေပုံပေါ်ရှိ နေရာကို နှိပ်ပြီး ရွေးပါ။
        </div>
      </div>
    </div>
  );
}