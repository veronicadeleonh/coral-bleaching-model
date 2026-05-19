import { useState, useEffect, useRef } from 'react';

const SLIDER_CONFIG = [
  {
    key: 'ssta_dhw', min: 0, max: 20, step: 0.1, unit: ' wks',
    emoji: '🌡️', name: 'Thermal stress',
    description: 'Weeks the ocean has been dangerously warm. Above 4 triggers bleaching, above 8 causes mortality.',
  },
  {
    key: 'ssta', min: -3, max: 5, step: 0.1, unit: '°C',
    emoji: '🌊', name: 'Temperature above normal',
    description: 'How many degrees warmer the ocean is than its long-term average.',
  },
  {
    key: 'sst', min: 14, max: 37, step: 0.1, unit: '°C',
    emoji: '🌡️', name: 'Ocean temperature',
    description: 'Actual sea surface temperature. Most reef corals live between 23–29°C.',
  },
  {
    key: 'ssta_frequency', min: 0, max: 20, step: 0.5, unit: '',
    emoji: '📊', name: 'Temperature spike frequency',
    description: 'How often temperatures spike above normal — chronic stress is more damaging than occasional spikes.',
  },
  {
    key: 'depth_m', min: 0, max: 50, step: 0.5, unit: 'm',
    emoji: '🤿', name: 'Depth',
    description: 'Depth of the coral. Deeper corals have less access to cooling currents during heat events.',
  },
];

function ImpactDots({ importance }) {
  const filled = importance != null ? Math.round(importance * 5) : 0;
  return (
    <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}
         title="Impact on bleaching prediction for this reef">
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} style={{
          width: '4px', height: '12px', borderRadius: '2px',
          background: i < filled ? 'var(--primary)' : 'var(--hairline)',
        }} />
      ))}
    </div>
  );
}

// Controlled component — vals and onValChange come from Explorer
export default function Sliders({ vals, onValChange, historicalContext }) {
  const [shapImportance, setShapImportance] = useState(null);
  const lastShapVals = useRef(null);

  useEffect(() => {
    const shouldFetch = !lastShapVals.current ||
      SLIDER_CONFIG.some(({ key, min, max }) => {
        const prev = lastShapVals.current[key] ?? min;
        const curr = vals[key] ?? min;
        return Math.abs(curr - prev) > 0.15 * (max - min);
      });

    if (!shouldFetch) return;

    lastShapVals.current = { ...vals };
    fetch('/api/shap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vals),
    })
      .then(r => r.json())
      .then(data => { if (data.importance) setShapImportance(data.importance); })
      .catch(() => {});
  }, [vals]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

      {/* Sliders card */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--hairline)',
        borderRadius: 'var(--radius-lg)',
        padding: '14px 16px',
      }}>
        <div style={{
          fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.07em',
          color: 'var(--stone)', textTransform: 'uppercase', marginBottom: '16px',
        }}>
          Adjust conditions — What if?
        </div>

        <div>
          {SLIDER_CONFIG.map(({ key, min, max, step, unit, emoji, name, description }) => (
            <div key={key} style={{ marginBottom: '16px' }} title={description}>
              {/* Line 1: emoji · name · impact dots · value+unit */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.9rem' }}>{emoji}</span>
                <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--charcoal)', flex: 1 }}>
                  {name}
                </span>
                <ImpactDots importance={shapImportance ? (shapImportance[key] ?? 0) : null} />
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--primary)', minWidth: '48px', textAlign: 'right' }}>
                  {vals[key]?.toFixed(1)}{unit}
                </span>
              </div>

              {/* Track */}
              <input
                type="range"
                min={min} max={max} step={step}
                value={vals[key] ?? min}
                onChange={e => onValChange(key, e.target.value)}
                style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer' }}
              />

              {/* Min / max */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--muted)', marginTop: '2px' }}>
                <span>{min}{unit}</span>
                <span>{max}{unit}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Thermal stress bar */}
        {(() => {
          const dhw      = vals.ssta_dhw || 0;
          const dhwPct   = Math.min(dhw / 20, 1) * 100;
          const barColor = dhw < 4 ? 'var(--success)' : dhw < 8 ? 'var(--brand-orange)' : 'var(--error)';
          return (
            <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--hairline)' }}>
              <div style={{ fontSize: '0.6875rem', color: 'var(--stone)', fontWeight: 500, marginBottom: '5px' }}>
                Thermal stress (DHW)
              </div>
              <div style={{ background: 'var(--hairline)', borderRadius: 'var(--radius-xs)', height: '6px', overflow: 'hidden' }}>
                <div style={{
                  width: `${dhwPct}%`, background: barColor,
                  height: '100%', borderRadius: 'var(--radius-xs)', transition: 'width 0.3s ease',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--muted)', marginTop: '3px' }}>
                <span>None</span>
                <span>Bleaching (4 wks)</span>
                <span>Mortality (8 wks)</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Historical context */}
      <div style={{ minHeight: '36px' }}>
        {historicalContext && (
          <div style={{
            background: 'var(--tint-sky)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            borderLeft: '3px solid var(--brand-teal)',
            fontSize: '0.8rem', color: 'var(--charcoal)', lineHeight: 1.55,
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
