import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default icon paths broken by Vite bundling
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function makeIcon(color) {
  const colorMap = {
    blue: '#3b82f6',
    green: '#22c55e',
    orange: '#f97316',
    red: '#ef4444',
    gray: '#6b7280',
  };
  const fill = colorMap[color] ?? colorMap.gray;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
    <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24S24 21 24 12C24 5.373 18.627 0 12 0z" fill="${fill}" stroke="white" stroke-width="1.5"/>
    <circle cx="12" cy="12" r="5" fill="white" opacity="0.9"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36],
  });
}

const CATEGORY_COLOR = {
  vehicle: 'blue',
  vehicles: 'blue',
  building: 'green',
  buildings: 'green',
  machine: 'orange',
  machines: 'orange',
};

const STATIC_LOCATIONS = [
  { id: 'city-hall', category: 'building', lat: 51.505, lng: -0.09, status: 'online' },
  { id: 'vehicle-01', category: 'vehicle', lat: 51.51, lng: -0.1, status: 'online' },
  { id: 'vehicle-02', category: 'vehicle', lat: 51.50, lng: -0.08, status: 'online' },
  { id: 'machine-01', category: 'machine', lat: 51.498, lng: -0.092, status: 'online' },
  { id: 'building-01', category: 'building', lat: 51.503, lng: -0.083, status: 'online' },
];

export default function IoTMap({ devices, anomalies = [] }) {
  const pins = devices && devices.length > 0 ? devices : STATIC_LOCATIONS;
  const anomalySet = new Set(anomalies);

  return (
    <div className="rounded-lg overflow-hidden h-80 w-full border border-gray-700">
      <MapContainer
        center={[51.505, -0.09]}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {pins.map((device) => {
          const isAnomaly = anomalySet.has(device.id);
          const catColor = CATEGORY_COLOR[device.category?.toLowerCase()] ?? 'gray';
          const color = isAnomaly ? 'red' : catColor;
          return (
            <Marker
              key={device.id}
              position={[device.lat, device.lng]}
              icon={makeIcon(color)}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-bold">{device.id}</p>
                  <p className="text-gray-600 capitalize">{device.category}</p>
                  <p className={device.status === 'online' ? 'text-green-600' : 'text-red-600'}>
                    {device.status}
                  </p>
                  {isAnomaly && <p className="text-red-500 font-semibold">⚠ Anomaly</p>}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
