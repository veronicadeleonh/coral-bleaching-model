import { useState, useEffect, useCallback } from 'react';
import { useFetch } from '../hooks/useFetch';
import SeverityCard from './SeverityCard';

const SLIDER_CONFIG = [
  {
    key: 'ssta_dhw', min: 0, max: 20, step: 0.1,
    label: '🌡️ Thermal stress',
    sublabel: 'Weeks the ocean has been dangerously warm',
    tooltip: 'Above 4 weeks triggers bleaching. Above 8 weeks can kill coral.',
  },
  {
    key: 'ssta', min: -3, max: 5, step: 0.1,
    label: '🌊 Temperature above normal',
    sublabel: 'Degrees warmer than the long-term average (°C)',
    tooltip: 'How much warmer the ocean is compared to its historical baseline.',
  },
  {
    key: 'sst', min: 14, max: 37, step: 0.1,
    label: '🌡️ Ocean temperature',
    sublabel: 'Sea surface temperature (°C)',
    tooltip: 'Most reef corals live between 23–29°C. Above 30°C causes rapid bleaching.',
  },
  {
    key: 'ssta_frequency', min: 0, max: 20, step: 0.5,
    label: '📊 How often temperatures spike',
    sublabel: 'Frequency of temperature anomalies',
    tooltip: 'Chronic stress is more damaging than occasional spikes.',
  },
  {
    key: 'depth_m', min: 0, max: 50, step: 0.5,
    label: '🤿 Depth (m)',
    sublabel: 'Depth of the coral measurement',
    tooltip: 'Deeper corals have less access to cooling currents during heat events.',
  },
];

const DEFAULT_VALS = {
  ssta_dhw: 2.0, ssta_frequency: 3.0, ssta: 0.3,
  sst: 28.0, depth_m: 8.0,
  bleaching_level: 'Colony', exposure: 'Exposed', ocean: 'Atlantic',
};

export default function Sliders({ onReefSelect }) {
  const [vals,      setVals]      = useState(DEFAULT_VALS);
  const [result,    setResult]    = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [reefLabel, setReefLabel] = useState(null);

  const { data: presets } = useFetch('/api/presets');
  const { data: reefs   } = useFetch('/api/reefs');

  // Debounced predict call
  const runPredict = useCallback(async (v) => {
    setLoading(true);
    try {
      const res = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(v),
      });
      const data = await res.json();
      setResult({ ...data, dhw_value: v.ssta_dhw });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => runPredict(vals), 300);
    return () => clearTimeout(t);
  }, [vals, runPredict]);

  function loadPreset(preset) {
    setVals({ ...preset.values, bleaching_level: 'Colony' });
    setReefLabel(preset.name);
    onReefSelect?.(null);
  }

  function loadReef(ecoregion) {
    const reef = reefs?.find(r => r.ecoregion === ecoregion);
    if (!reef) return;
    setVals({
      ssta_dhw:        reef.avg_dhw,
      ssta_frequency:  reef.avg_freq,
      ssta:            reef.avg_ssta,
      sst:             reef.avg_sst,
      depth_m:         reef.avg_depth,
      bleaching_level: 'Colony',
      exposure:        reef.exposure,
      ocean:           reef.ocean,
    });
    setReefLabel(reef.ecoregion);
    onReefSelect?.(reef);
  }

  function handleSlider(key, value) {
    setVals(v => ({ ...v, [key]: parseFloat(value) }));
    setReefLabel(null);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Reef search */}
      <div style={{
        background: 'white', borderRadius: 'var(--radius)',
        padding: '16px', boxShadow: 'var(--shadow)',
      }}>
        <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--gray-600)', display: 'block', marginBottom: '8px' }}>
          SEARCH A REEF
        </label>
        <select
          onChange={e => loadReef(e.target.value)}
          defaultValue=""
          style={{
            width: '100%', padding: '10px 12px',
            border: '1px solid var(--gray-200)', borderRadius: '8px',
            fontSize: '0.875rem', background: 'white',
            color: 'var(--gray-900)', cursor: 'pointer',
          }}
        >
          <option value="" disabled>— choose a reef to load its conditions —</option>
          {reefs?.sort((a,b) => a.ecoregion.localeCompare(b.ecoregion))
               .map(r => (
            <option key={r.ecoregion} value={r.ecoregion}>{r.ecoregion}</option>
          ))}
        </select>
        {reefLabel && (
          <div style={{
            marginTop: '8px', fontSize: '0.8rem',
            color: 'var(--teal)', fontWeight: 500
          }}>
            ✓ Exploring: {reefLabel}
          </div>
        )}
      </div>

      {/* Historical presets */}
      <div style={{
        background: 'white', borderRadius: 'var(--radius)',
        padding: '16px', boxShadow: 'var(--shadow)',
      }}>
        <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--gray-600)', display: 'block', marginBottom: '10px' }}>
          OR LOAD A HISTORICAL EVENT
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {presets?.map(preset => (
            <button
              key={preset.name}
              onClick={() => loadPreset(preset)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--gray-100)', border: '1px solid var(--gray-200)',
                borderRadius: '8px', padding: '10px 14px',
                cursor: 'pointer', textAlign: 'left', width: '100%',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#e8f4f8'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--gray-100)'}
            >
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--gray-900)', marginBottom: '2px' }}>
                  {preset.name}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--gray-600)', lineHeight: 1.3 }}>
                  {preset.description}
                </div>
              </div>
              <div style={{
                fontSize: '0.75rem', fontWeight: 600,
                color: preset.severity?.key === 'healthy' ? '#155724' : '#721c24',
                background: preset.severity?.key === 'healthy' ? '#d4edda' : '#f8d7da',
                padding: '3px 8px', borderRadius: '10px', whiteSpace: 'nowrap', marginLeft: '10px'
              }}>
                {preset.prediction?.severity?.toFixed(0)}% bleaching
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Sliders */}
      <div style={{
        background: 'white', borderRadius: 'var(--radius)',
        padding: '16px', boxShadow: 'var(--shadow)',
      }}>
        <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--gray-600)', display: 'block', marginBottom: '12px' }}>
          ADJUST CONDITIONS — WHAT IF?
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {SLIDER_CONFIG.map(({ key, min, max, step, label, sublabel, tooltip }) => (
            <div key={key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '5px' }}>
                <div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--gray-900)' }}>{label}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--gray-600)', marginLeft: '6px' }}>{sublabel}</span>
                </div>
                <span style={{
                  fontSize: '0.9rem', fontWeight: 600,
                  color: 'var(--ocean)', minWidth: '48px', textAlign: 'right'
                }}>
                  {vals[key]?.toFixed(key === 'ssta' ? 1 : 1)}
                </span>
              </div>
              <input
                type="range"
                min={min} max={max} step={step}
                value={vals[key] ?? min}
                onChange={e => handleSlider(key, e.target.value)}
                title={tooltip}
                style={{ width: '100%', accentColor: 'var(--ocean)', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#adb5bd' }}>
                <span>{min}</span>
                <span>{max}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Prediction */}
      <SeverityCard result={result} loading={loading} />
    </div>
  );
}
