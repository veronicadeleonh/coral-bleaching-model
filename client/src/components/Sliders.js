import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';

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

// Controlled component — vals and onValChange come from Explorer
export default function Sliders({ vals, onValChange, onPresetLoad, historicalContext }) {
  const [presetsOpen, setPresetsOpen] = useState(false);
  const { data: presets } = useFetch('/api/presets');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

      {/* Historical presets — collapsed by default */}
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '10px', overflow: 'hidden',
      }}>
        <button
          onClick={() => setPresetsOpen(o => !o)}
          style={{
            width: '100%', background: 'none', border: 'none',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 14px', cursor: 'pointer',
            color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem', fontWeight: 500,
            letterSpacing: '0.05em',
          }}
        >
          <span>HISTORICAL EVENTS</span>
          <span style={{
            display: 'inline-block',
            transform: presetsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}>▾</span>
        </button>

        {presetsOpen && (
          <div style={{ padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {presets?.map(preset => (
              <button
                key={preset.name}
                onClick={() => onPresetLoad(preset)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px', padding: '9px 12px',
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
              >
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'rgba(255,255,255,0.85)', marginBottom: '2px' }}>
                    {preset.name}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.3 }}>
                    {preset.description}
                  </div>
                </div>
                <div style={{
                  fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap', marginLeft: '10px',
                  color: preset.severity?.key === 'healthy' ? '#6ee7b7' : '#fca5a5',
                }}>
                  {preset.prediction?.severity?.toFixed(0)}%
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* What-if sliders */}
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '10px', padding: '12px 14px',
      }}>
        <div style={{
          fontSize: '0.7rem', fontWeight: 500, letterSpacing: '0.05em',
          color: 'rgba(255,255,255,0.4)', marginBottom: '14px',
        }}>
          ADJUST CONDITIONS — WHAT IF?
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {SLIDER_CONFIG.map(({ key, min, max, step, label, sublabel, tooltip }) => (
            <div key={key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '5px' }}>
                <div>
                  <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>{label}</span>
                  <span style={{ fontSize: '0.67rem', color: 'rgba(255,255,255,0.35)', marginLeft: '6px' }}>{sublabel}</span>
                </div>
                <span style={{
                  fontSize: '0.88rem', fontWeight: 600,
                  color: 'var(--sky)', minWidth: '40px', textAlign: 'right',
                }}>
                  {vals[key]?.toFixed(1)}
                </span>
              </div>
              <input
                type="range"
                min={min} max={max} step={step}
                value={vals[key] ?? min}
                onChange={e => onValChange(key, e.target.value)}
                title={tooltip}
                style={{ width: '100%', accentColor: 'var(--teal)', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.64rem', color: 'rgba(255,255,255,0.2)' }}>
                <span>{min}</span>
                <span>{max}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Thermal stress bar — always rendered, driven by the ssta_dhw slider value */}
        {(() => {
          const dhw     = vals.ssta_dhw || 0;
          const dhwPct  = Math.min(dhw / 20, 1) * 100;
          const barColor = dhw < 4 ? '#2ecc71' : dhw < 8 ? '#f39c12' : '#e74c3c';
          return (
            <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>
                Thermal stress (DHW)
              </div>
              <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '3px', height: '6px', overflow: 'hidden' }}>
                <div style={{
                  width: `${dhwPct}%`, background: barColor,
                  height: '100%', borderRadius: '3px', transition: 'width 0.3s ease',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: 'rgba(255,255,255,0.25)', marginTop: '3px' }}>
                <span>None</span>
                <span>Bleaching (4 wks)</span>
                <span>Mortality (8 wks)</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Historical context — space always reserved so layout never shifts */}
      <div style={{ minHeight: '36px' }}>
        {historicalContext && (
          <div style={{
            background: 'rgba(0,150,199,0.1)',
            borderRadius: '8px', padding: '9px 12px',
            borderLeft: '2px solid var(--teal)',
            fontSize: '0.78rem', color: 'rgba(144,224,239,0.85)', lineHeight: 1.5,
          }}>
            {historicalContext.n} real observations in the{' '}
            <strong>{historicalContext.ocean}</strong> with similar stress averaged{' '}
            <strong>{historicalContext.avg_pct}%</strong> bleaching historically.
          </div>
        )}
      </div>
    </div>
  );
}
