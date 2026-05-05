import { useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMapEvents } from 'react-leaflet';
import { useFetch } from '../hooks/useFetch';
import 'leaflet/dist/leaflet.css';

function bleachingColor(pct) {
  if (pct < 15)  return '#2ecc71'; // green  — low bleaching
  if (pct < 40)  return '#f39c12'; // amber  — moderate
  return '#e74c3c';                // red    — severe
}

// Listens for clicks on the map background (not on markers)
function MapClickHandler({ onMapClick, markerClicked }) {
  useMapEvents({
    click: () => {
      if (!markerClicked.current) onMapClick?.();
    },
  });
  return null;
}

export default function ReefMap({ selectedReef, onReefClick, onMapClick }) {
  const { data: reefs, loading } = useFetch('/api/reefs');
  // Flag to prevent background-click handler firing when a marker was just clicked
  const markerClicked = useRef(false);

  if (loading) return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#e8f4f8', color: 'var(--gray-600)',
    }}>
      Loading map...
    </div>
  );

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <MapContainer
        center={[10, 10]}
        zoom={2}
        minZoom={2}
        maxBounds={[[-90, -180], [90, 180]]}
        maxBoundsViscosity={1.0}
        style={{ height: '100%', width: '100%', borderRadius: 0 }}
        scrollWheelZoom={true}
      >
        <MapClickHandler onMapClick={onMapClick} markerClicked={markerClicked} />

        <TileLayer
          attribution='&copy; <a href="https://carto.com">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {reefs?.map(reef => {
          const isSelected = selectedReef?.ecoregion === reef.ecoregion;
          return (
            <CircleMarker
              key={reef.ecoregion}
              center={[reef.lat, reef.lon]}
              radius={isSelected
                ? Math.max(5, Math.min(reef.n / 80, 12)) * 1.6
                : Math.max(5, Math.min(reef.n / 80, 12))}
              pathOptions={{
                fillColor:   isSelected ? '#0077b6' : bleachingColor(reef.avg_bleaching),
                fillOpacity: 0.9,
                color:       'white',
                weight:      isSelected ? 3 : 1.5,
              }}
              eventHandlers={{
                click: () => {
                  // Set flag so MapClickHandler ignores this event
                  markerClicked.current = true;
                  setTimeout(() => { markerClicked.current = false; }, 50);
                  onReefClick?.(reef);
                },
              }}
            >
              <Tooltip>
                <div style={{ fontSize: '0.8rem', lineHeight: 1.4 }}>
                  <strong>{reef.ecoregion}</strong><br />
                  {reef.ocean}<br />
                  Avg bleaching: {reef.avg_bleaching.toFixed(1)}%<br />
                  Ocean temp: {reef.avg_sst.toFixed(1)}°C
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Legend — bottom-left, clear of zoom controls (top-left) */}
      <div style={{
        position: 'absolute', bottom: '24px', left: '16px', zIndex: 1000,
        background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)',
        borderRadius: '8px', padding: '10px 14px',
        fontSize: '0.72rem', color: 'var(--gray-600)',
        boxShadow: 'var(--shadow)',
      }}>
        <div style={{ marginBottom: '6px', fontWeight: 500 }}>Avg bleaching</div>
        {[
          { color: '#2ecc71', label: '< 15%'  },
          { color: '#f39c12', label: '15–40%' },
          { color: '#e74c3c', label: '> 40%'  },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, border: '1.5px solid white', flexShrink: 0 }} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
