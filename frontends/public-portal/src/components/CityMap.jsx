import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix default leaflet icon issue with bundlers
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
})

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

const CITY_LOCATIONS = [
  { position: [51.51, -0.08], label: 'City Hall: Open' },
  { position: [51.503, -0.11], label: 'Central Station: Operational' },
  { position: [51.497, -0.085], label: 'District A: 15 buildings monitored' },
  { position: [51.518, -0.095], label: 'Industrial Zone: 10 machines online' },
  { position: [51.509, -0.102], label: 'Transport Hub: 30 vehicles tracked' },
]

export default function CityMap({ incidents = [] }) {
  const incidentsWithCoords = incidents.filter(
    (inc) => inc.location?.lat != null && inc.location?.lng != null
  )

  return (
    <MapContainer
      center={[51.505, -0.09]}
      zoom={13}
      className="h-96 w-full rounded-xl overflow-hidden"
      style={{ zIndex: 0 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {CITY_LOCATIONS.map((loc) => (
        <Marker key={loc.label} position={loc.position}>
          <Popup>{loc.label}</Popup>
        </Marker>
      ))}

      {incidentsWithCoords.map((inc) => (
        <Marker
          key={inc.id}
          position={[inc.location.lat, inc.location.lng]}
          icon={redIcon}
        >
          <Popup>
            <strong>{inc.title}</strong>
            <br />
            Severity: {inc.severity}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
