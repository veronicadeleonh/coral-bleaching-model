import { useState, useEffect, useCallback } from 'react';
import ReefMap from './ReefMap';
import Sliders from './Sliders';
import SeverityCard from './SeverityCard';

const DEFAULT_VALS = {
  ssta_dhw: 2.0, ssta_frequency: 3.0, ssta: 0.3,
  sst: 28.0, depth_m: 8.0,
  bleaching_level: 'Colony', exposure: 'Exposed', ocean: 'Atlantic',
};

const MOBILE_HEIGHT = {
  collapsed: '40px',
  exploring: '55vh',
};

function reefDotColor(pct) {
  if (pct < 15) return '#1aae39';
  if (pct < 40) return '#dd5b00';
  return '#e03131';
}

// Historical card tint matches SeverityCard pastel palette
function historicalStyle(pct) {
  if (pct < 15) return { bg: 'var(--tint-mint)',  color: 'var(--success)',       dot: '#1aae39' };
  if (pct < 40) return { bg: 'var(--tint-yellow)', color: 'var(--brand-orange)', dot: '#dd5b00' };
  return               { bg: 'var(--tint-rose)',   color: 'var(--error)',         dot: '#e03131' };
}

export default function Explorer() {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);

  const [panelState,     setPanelState]     = useState('collapsed');
  const [selectedReef,   setSelectedReef]   = useState(null);
  const [vals,           setVals]           = useState(DEFAULT_VALS);
  const [result,         setResult]         = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [slidersTouched, setSlidersTouched] = useState(false);

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Prediction ────────────────────────────────────────────────────────────────
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
    if (panelState !== 'exploring' || !slidersTouched) return;
    const t = setTimeout(() => runPredict(vals), 300);
    return () => clearTimeout(t);
  }, [vals, panelState, slidersTouched, runPredict]);

  // ── Event handlers ────────────────────────────────────────────────────────────
  function handleReefClick(reef) {
    setSelectedReef(reef);
    setVals({
      ssta_dhw:        reef.avg_dhw   ?? DEFAULT_VALS.ssta_dhw,
      ssta_frequency:  reef.avg_freq  ?? DEFAULT_VALS.ssta_frequency,
      ssta:            reef.avg_ssta  ?? DEFAULT_VALS.ssta,
      sst:             reef.avg_sst   ?? DEFAULT_VALS.sst,
      depth_m:         reef.avg_depth ?? DEFAULT_VALS.depth_m,
      bleaching_level: 'Colony',
      exposure:        reef.exposure  || DEFAULT_VALS.exposure,
      ocean:           reef.ocean     || DEFAULT_VALS.ocean,
    });
    setSlidersTouched(false);
    setResult(null);
    setPanelState('exploring');
  }

  function handleMapClick() {
    setSelectedReef(null);
    setPanelState('collapsed');
  }

  function handleValChange(key, value) {
    setSlidersTouched(true);
    setVals(v => ({ ...v, [key]: parseFloat(value) }));
  }

  function closePanel() {
    setSelectedReef(null);
    setPanelState('collapsed');
  }

  // ── Panel content ─────────────────────────────────────────────────────────────
  function renderHistoricalCard(reef) {
    const pct   = reef.avg_bleaching;
    const { bg, color, dot } = historicalStyle(pct);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ background: bg, borderRadius: 'var(--radius-lg)', padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{
              width: '10px', height: '10px', borderRadius: '50%',
              background: dot, flexShrink: 0,
            }} />
            <div>
              <div style={{ fontSize: '0.6875rem', color, fontWeight: 500, lineHeight: 1, marginBottom: '3px', opacity: 0.8 }}>
                Historical average
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1, color }}>
                {pct.toFixed(1)}% bleaching
              </div>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: '0.8125rem', fontStyle: 'italic', color, opacity: 0.75, lineHeight: 1.5 }}>
            Average bleaching recorded across all observations in this reef (1980–2020).
          </p>
        </div>
        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--stone)', lineHeight: 1.5 }}>
          Move the sliders below to run the prediction model →
        </p>
      </div>
    );
  }

  function renderPanelContent() {
    const showHistorical = !slidersTouched && selectedReef;
    return (
      <>
        {showHistorical
          ? renderHistoricalCard(selectedReef)
          : <SeverityCard result={result} loading={loading} label="Predicted bleaching" />
        }
        <div style={{ marginTop: '16px' }}>
          <Sliders vals={vals} onValChange={handleValChange} historicalContext={result?.historical_context} />
        </div>
      </>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', top: '56px', left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>

      <ReefMap
        selectedReef={selectedReef}
        onReefClick={handleReefClick}
        onMapClick={handleMapClick}
      />

      {/* Floating reef info pill */}
      {selectedReef && (
        <div style={{
          position: 'absolute', top: '16px', left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 400,
          background: 'var(--canvas)',
          borderRadius: 'var(--radius-full)',
          padding: '7px 18px',
          border: '1px solid var(--hairline)',
          boxShadow: 'var(--shadow-2)',
          display: 'flex', alignItems: 'center', gap: '8px',
          fontSize: '0.8125rem', color: 'var(--ink)',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          userSelect: 'none',
        }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: reefDotColor(selectedReef.avg_bleaching),
            flexShrink: 0,
          }} />
          <span style={{ fontWeight: 600 }}>{selectedReef.ecoregion}</span>
          <span style={{ color: 'var(--hairline-strong)', fontSize: '0.7rem' }}>|</span>
          <span style={{ color: 'var(--slate)' }}>{selectedReef.avg_bleaching?.toFixed(1)}% bleaching</span>
          <span style={{ color: 'var(--hairline-strong)', fontSize: '0.7rem' }}>|</span>
          <span style={{ color: 'var(--slate)' }}>{selectedReef.avg_sst?.toFixed(1)}°C</span>
        </div>
      )}

      {isDesktop ? (
        // ── Desktop: right-side panel ─────────────────────────────────────────────
        <>
          {panelState === 'collapsed' && (
            <div style={{
              position: 'absolute', right: 0, top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 501,
              background: 'var(--canvas)',
              border: '1px solid var(--hairline)',
              borderRight: 'none',
              borderRadius: 'var(--radius-md) 0 0 var(--radius-md)',
              padding: '14px 10px',
              color: 'var(--stone)',
              fontSize: '1rem',
              pointerEvents: 'none',
              userSelect: 'none',
              boxShadow: 'var(--shadow-1)',
            }}>
              →
            </div>
          )}

          <div style={{
            position: 'absolute', right: 0, top: 0, bottom: 0,
            width: '380px',
            transform: panelState === 'collapsed' ? 'translateX(100%)' : 'translateX(0)',
            transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
            background: 'var(--canvas)',
            borderLeft: '1px solid var(--hairline)',
            boxShadow: 'none',
            display: 'flex', flexDirection: 'column',
            zIndex: 500,
          }}>
            {/* Panel header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '18px 20px 14px',
              borderBottom: '1px solid var(--hairline)',
              flexShrink: 0,
            }}>
              <span style={{ color: 'var(--ink-subtle)', fontSize: '0.875rem', fontWeight: 500 }}>
                What if?
              </span>
              <button
                onClick={closePanel}
                style={{
                  background: 'var(--surface-1)',
                  border: '1px solid var(--hairline)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--ink-muted)',
                  width: '28px', height: '28px', fontSize: '1rem',
                  cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-1)'}
                aria-label="Close panel"
              >
                ×
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 24px' }}>
              {panelState === 'exploring' && renderPanelContent()}
            </div>
          </div>
        </>
      ) : (
        // ── Mobile: bottom sheet ──────────────────────────────────────────────────
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: MOBILE_HEIGHT[panelState],
          background: 'var(--canvas)',
          borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
          borderTop: '1px solid var(--hairline)',
          transition: 'height 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
          zIndex: 500,
          boxShadow: 'none',
          display: 'flex', flexDirection: 'column',
        }}>
          <div
            onClick={panelState !== 'collapsed' ? closePanel : undefined}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '10px 0 8px',
              cursor: panelState !== 'collapsed' ? 'pointer' : 'default',
              flexShrink: 0,
            }}
          >
            <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--hairline-strong)' }} />
            {panelState === 'collapsed' && (
              <span style={{ color: 'var(--stone)', fontSize: '0.8rem', marginTop: '6px' }}>
                Click a reef to explore ↑
              </span>
            )}
          </div>

          {panelState === 'exploring' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 20px 24px' }}>
              {renderPanelContent()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
