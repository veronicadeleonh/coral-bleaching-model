import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import { useFetch } from '../hooks/useFetch';
import 'leaflet/dist/leaflet.css';

function bleachingColor(pct) {
  const t = Math.min(pct / 80, 1);
  const r = Math.round(59  + t * (220 - 59));
  const g = Math.round(130 + t * (53  - 130));
  const b = Math.round(246 + t * (69  - 246));
  return `rgb(${r},${g},${b})`;
}

export default function ReefMap({ selectedReef }) {
  const { data: reefs, loading } = useFetch('/api/reefs');

  if (loading) return (
    <div style={{
      height: '100%', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#e8f4f8',
      borderRadius: 'var(--radius)', color: 'var(--gray-600)',
    }}>
      Loading map...
    </div>
  );

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <MapContainer
        center={[10, 10]}
        zoom={2}
        style={{ height: '100%', width: '100%', borderRadius: 'var(--radius)' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        {reefs?.map(reef => {
          const isSelected = selectedReef?.ecoregion === reef.ecoregion;
          return (
            <CircleMarker
              key={reef.ecoregion}
              center={[reef.lat, reef.lon]}
              radius={isSelected ? 10 : Math.max(5, Math.min(reef.n / 80, 12))}
              pathOptions={{
                fillColor:   isSelected ? '#0077b6' : bleachingColor(reef.avg_bleaching),
                fillOpacity: 0.8,
                color:       isSelected ? '#023e8a' : 'white',
                weight:      isSelected ? 2 : 0.5,
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

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: '16px', left: '16px', zIndex: 1000,
        background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)',
        borderRadius: '8px', padding: '10px 14px',
        fontSize: '0.72rem', color: 'var(--gray-600)',
        boxShadow: 'var(--shadow)',
      }}>
        <div style={{ marginBottom: '5px', fontWeight: 500 }}>Avg bleaching</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>Low</span>
          <div style={{
            width: '80px', height: '8px', borderRadius: '4px',
            background: 'linear-gradient(to right, rgb(59,130,246), rgb(220,53,69))'
          }} />
          <span>High</span>
        </div>
      </div>
    </div>
  );
}
