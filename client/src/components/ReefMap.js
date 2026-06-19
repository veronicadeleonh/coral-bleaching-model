import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { useFetch } from '../hooks/useFetch';
import { API } from '../api';
import 'maplibre-gl/dist/maplibre-gl.css';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

// ── Label customization ───────────────────────────────────────────────
const LABEL_FONT       = ['Open Sans Regular', 'Noto Sans Regular'];
const LABEL_SIZE_SCALE = 1.0;

function bleachingColor(pct) {
  if (pct < 15) return '#2ecc71';
  if (pct < 40) return '#f39c12';
  return '#e74c3c';
}

export default function ReefMap({ selectedReef, onReefClick, onMapClick }) {
  const { data: reefs, loading } = useFetch(API.reefs);
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const [hoverReef, setHoverReef]   = useState(null);
  const [popupPos,  setPopupPos]    = useState(null);

  // ── Init map ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [10, 20],
      zoom: 1.5,
      minZoom: 1,
    });

    map.on('load', () => {
      // Label font / size customization
      map.getStyle().layers.forEach(layer => {
        if (layer.type !== 'symbol' || !layer.layout?.['text-field']) return;
        map.setLayoutProperty(layer.id, 'text-font', LABEL_FONT);
        if (LABEL_SIZE_SCALE !== 1) {
          const sz = map.getLayoutProperty(layer.id, 'text-size');
          if (typeof sz === 'number') map.setLayoutProperty(layer.id, 'text-size', sz * LABEL_SIZE_SCALE);
        }
      });

      // Tropical reef belt parallels (30°N and 30°S)
      map.addSource('parallels', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [30, -30].map(lat => ({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [[-180, lat], [180, lat]] },
          })),
        },
      });
      map.addLayer({
        id: 'parallels-line',
        type: 'line',
        source: 'parallels',
        paint: {
          'line-color': '#5645d4',
          'line-width': 1.2,
          'line-dasharray': [4, 4],
          'line-opacity': 0.5,
        },
      });

      // Reefs source + layer (added empty; data filled by the other effect)
      map.addSource('reefs', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'reefs-circles',
        type: 'circle',
        source: 'reefs',
        paint: {
          'circle-radius':       ['get', 'radius'],
          'circle-color':        ['get', 'color'],
          'circle-opacity':      0.9,
          'circle-stroke-color': 'rgba(0,0,0,0.3)',
          'circle-stroke-width': ['get', 'strokeWidth'],
        },
      });
    });

    map.on('click', 'reefs-circles', (e) => {
      const props = e.features[0].properties;
      onReefClick?.({ ecoregion: props.ecoregion, ocean: props.ocean, avg_bleaching: props.avg_bleaching, avg_sst: props.avg_sst });
    });

    map.on('click', (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ['reefs-circles'] });
      if (!features.length) onMapClick?.();
    });

    map.on('mousemove', 'reefs-circles', (e) => {
      map.getCanvas().style.cursor = 'pointer';
      const props = e.features[0].properties;
      setHoverReef(props);
      setPopupPos({ x: e.point.x, y: e.point.y });
    });

    map.on('mouseleave', 'reefs-circles', () => {
      map.getCanvas().style.cursor = '';
      setHoverReef(null);
      setPopupPos(null);
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []); // mount only

  // ── Sync reef GeoJSON ────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !reefs) return;

    const ready = () => {
      const source = map.getSource('reefs');
      if (!source) return;
      source.setData({
        type: 'FeatureCollection',
        features: reefs.map(reef => {
          const isSelected = selectedReef?.ecoregion === reef.ecoregion;
          return {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [reef.lon, reef.lat] },
            properties: {
              ecoregion:     reef.ecoregion,
              ocean:         reef.ocean,
              avg_bleaching: reef.avg_bleaching,
              avg_sst:       reef.avg_sst,
              color:         isSelected ? '#0077b6' : bleachingColor(reef.avg_bleaching),
              radius:        isSelected ? (5 + (reef.avg_bleaching / 100) * 15) * 1.6 : 5 + (reef.avg_bleaching / 100) * 15,
              strokeWidth:   isSelected ? 3 : 1.5,
            },
          };
        }),
      });
    };

    if (map.isStyleLoaded()) ready();
    else map.once('load', ready);
  }, [reefs, selectedReef]);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* Map container — always mounted so the ref is available on first render */}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Loading overlay */}
      {loading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#e8f4f8', zIndex: 500, gap: '12px' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 500, color: '#2c3e50' }}>Loading reef data...</div>
          <div style={{ fontSize: '0.85rem', color: '#7f8c8d', maxWidth: '280px', textAlign: 'center', lineHeight: 1.5 }}>
            The server may take up to 30 seconds to wake up on first load. Thanks for your patience 🪸
          </div>
        </div>
      )}

      {/* Hover tooltip */}
      {hoverReef && popupPos && (
        <div style={{
          position: 'absolute',
          left: popupPos.x + 12, top: popupPos.y - 10,
          background: 'white', borderRadius: '6px', padding: '8px 12px',
          boxShadow: 'var(--shadow-2)', fontSize: '0.8rem', lineHeight: 1.4,
          pointerEvents: 'none', zIndex: 1000,
        }}>
          <strong>{hoverReef.ecoregion}</strong><br />
          {hoverReef.ocean}<br />
          Avg bleaching: {Number(hoverReef.avg_bleaching).toFixed(1)}%<br />
          Ocean temp: {Number(hoverReef.avg_sst).toFixed(1)}°C
        </div>
      )}

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: '24px', left: '16px', zIndex: 1000,
        background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)',
        borderRadius: '8px', padding: '10px 14px',
        fontSize: '0.72rem', color: 'var(--gray-600)',
        boxShadow: 'var(--shadow)',
      }}>
        <div style={{ marginBottom: '6px', fontWeight: 500 }}>Bleaching intensity</div>
        <div style={{ fontSize: '0.67rem', color: 'var(--gray-600)', marginBottom: '6px' }}>Circle size + color</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #e5e3df' }}>
          <div style={{ width: '18px', borderTop: '2px dashed #5645d4', opacity: 0.7, flexShrink: 0 }} />
          <span style={{ fontSize: '0.67rem', color: 'var(--gray-600)' }}>30°N / 30°S reef belt</span>
        </div>
        {[
          { color: '#2ecc71', label: '< 15%',  size: 7  },
          { color: '#f39c12', label: '15–40%', size: 10 },
          { color: '#e74c3c', label: '> 40%',  size: 13 },
        ].map(({ color, label, size }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <div style={{ width: `${size}px`, height: `${size}px`, borderRadius: '50%', background: color, border: '1.5px solid white', flexShrink: 0 }} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
