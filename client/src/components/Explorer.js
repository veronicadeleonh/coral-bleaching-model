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
  collapsed: '36px',
  exploring: '55vh',
};

const PANEL_BG          = 'linear-gradient(180deg, #0d2137 0%, #0a3352 100%)';
const PANEL_SHADOW_SIDE = '-4px 0 32px rgba(0,0,0,0.4)';
const PANEL_SHADOW_BTM  = '0 -4px 32px rgba(0,0,0,0.45)';

function reefDotColor(pct) {
  if (pct < 15) return '#2ecc71';
  if (pct < 40) return '#f39c12';
  return '#e74c3c';
}

// Returns bg/textColor matching SeverityCard's STYLES for the historical card
function historicalStyle(pct) {
  if (pct < 15) return { bg: 'rgba(46, 204, 113, 0.14)', color: '#6ee7b7' };
  if (pct < 40) return { bg: 'rgba(243, 156, 18, 0.14)',  color: '#fcd34d' };
  return           { bg: 'rgba(231, 76, 60, 0.14)',  color: '#fca5a5' };
}

export default function Explorer() {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);

  const [panelState,     setPanelState]     = useState('collapsed');
  const [selectedReef,   setSelectedReef]   = useState(null);
  const [vals,           setVals]           = useState(DEFAULT_VALS);
  const [result,         setResult]         = useState(null);
  const [loading,        setLoading]        = useState(false);
  // false = show historical avg; true = model has been triggered by slider/preset
  const [slidersTouched, setSlidersTouched] = useState(false);

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Prediction ───────────────────────────────────────────────────────────────
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

  // Only runs prediction after the user first touches a slider
  useEffect(() => {
    if (panelState !== 'exploring' || !slidersTouched) return;
    const t = setTimeout(() => runPredict(vals), 300);
    return () => clearTimeout(t);
  }, [vals, panelState, slidersTouched, runPredict]);

  // ── Event handlers ───────────────────────────────────────────────────────────

  // Reef click → load historical conditions, open panel, NO predict call yet
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
    setSlidersTouched(false);   // reset — show historical data, not model
    setResult(null);
    setPanelState('exploring');
  }

  function handleMapClick() {
    setSelectedReef(null);
    setPanelState('collapsed');
  }

  // Slider change → first touch triggers the model
  function handleValChange(key, value) {
    setSlidersTouched(true);
    setVals(v => ({ ...v, [key]: parseFloat(value) }));
  }

  function closePanel() {
    setSelectedReef(null);
    setPanelState('collapsed');
  }

  // ── Panel content ────────────────────────────────────────────────────────────

  // Historical card — mirrors SeverityCard layout, uses reef.avg_bleaching directly
  function renderHistoricalCard(reef) {
    const pct   = reef.avg_bleaching;
    const dot   = reefDotColor(pct);
    const { bg, color } = historicalStyle(pct);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ background: bg, borderRadius: 'var(--radius)', padding: '12px 14px' }}>
          {/* Icon row: colored dot + label / percentage */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{
              width: '12px', height: '12px', borderRadius: '50%',
              background: dot, flexShrink: 0,
              boxShadow: `0 0 6px ${dot}`,
            }} />
            <div>
              <div style={{ fontSize: '0.72rem', color, opacity: 0.65, lineHeight: 1, marginBottom: '3px' }}>
                Historical average
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, lineHeight: 1, color }}>
                {pct.toFixed(1)}% bleaching
              </div>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', fontStyle: 'italic', color, opacity: 0.75, lineHeight: 1.45 }}>
            This is the average bleaching recorded across all observations in this reef (1980–2020).
          </p>
        </div>

        {/* Visual hint */}
        <p style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>
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
        <div style={{ marginTop: '14px' }}>
          <Sliders vals={vals} onValChange={handleValChange} historicalContext={result?.historical_context} />
        </div>
      </>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', top: '64px', left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>

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
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(8px)',
          borderRadius: '20px',
          padding: '7px 16px',
          boxShadow: '0 2px 16px rgba(0,0,0,0.18)',
          display: 'flex', alignItems: 'center', gap: '8px',
          fontSize: '0.82rem', color: 'var(--gray-900)',
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
          <span style={{ color: 'var(--gray-200)', fontSize: '0.7rem' }}>|</span>
          <span>{selectedReef.avg_bleaching?.toFixed(1)}% bleaching</span>
          <span style={{ color: 'var(--gray-200)', fontSize: '0.7rem' }}>|</span>
          <span>{selectedReef.avg_sst?.toFixed(1)}°C</span>
        </div>
      )}

      {isDesktop ? (
        // ── Desktop: right-side sliding panel ───────────────────────────────────
        <>
          {panelState === 'collapsed' && (
            <div style={{
              position: 'absolute', right: 0, top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 501,
              background: 'rgba(13, 17, 38, 0.82)',
              backdropFilter: 'blur(8px)',
              borderRadius: '8px 0 0 8px',
              padding: '14px 10px',
              color: 'rgba(255,255,255,0.45)',
              fontSize: '1rem',
              pointerEvents: 'none',
              userSelect: 'none',
            }}>
              →
            </div>
          )}

          <div style={{
            position: 'absolute', right: 0, top: 0, bottom: 0,
            width: '380px',
            transform: panelState === 'collapsed' ? 'translateX(100%)' : 'translateX(0)',
            transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
            background: PANEL_BG,
            backdropFilter: 'blur(16px)',
            boxShadow: PANEL_SHADOW_SIDE,
            display: 'flex', flexDirection: 'column',
            zIndex: 500,
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '18px 20px 12px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              flexShrink: 0,
            }}>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', fontWeight: 500, letterSpacing: '0.06em' }}>
                WHAT IF?
              </span>
              <button
                onClick={closePanel}
                style={{
                  background: 'rgba(255,255,255,0.07)', border: 'none',
                  borderRadius: '6px', color: 'rgba(255,255,255,0.55)',
                  width: '28px', height: '28px', fontSize: '1.1rem',
                  cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                aria-label="Close panel"
              >
                ×
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 20px' }}>
              {panelState === 'exploring' && renderPanelContent()}
            </div>
          </div>
        </>
      ) : (
        // ── Mobile: bottom sheet ─────────────────────────────────────────────────
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: MOBILE_HEIGHT[panelState],
          background: PANEL_BG,
          backdropFilter: 'blur(16px)',
          borderRadius: '16px 16px 0 0',
          transition: 'height 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
          zIndex: 500,
          boxShadow: PANEL_SHADOW_BTM,
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
            <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.2)' }} />
            {panelState === 'collapsed' && (
              <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.78rem', marginTop: '6px', letterSpacing: '0.02em' }}>
                Click a reef to explore ↑
              </span>
            )}
          </div>

          {panelState === 'exploring' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 20px 20px' }}>
              {renderPanelContent()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
