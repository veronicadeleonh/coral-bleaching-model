import { useState, useEffect, useCallback } from 'react';
import ReefMap from './ReefMap';
import Sliders from './Sliders';
import SeverityCard from './SeverityCard';

const DEFAULT_VALS = {
  ssta_dhw: 2.0, ssta_frequency: 3.0, ssta: 0.3,
  sst: 28.0, depth_m: 8.0,
  bleaching_level: 'Colony', exposure: 'Exposed', ocean: 'Atlantic',
};

// Mobile bottom-sheet heights per state
const MOBILE_HEIGHT = {
  collapsed: '36px',
  reef:      '220px',
  exploring: '55vh',
};

const PANEL_BG  = 'rgba(13, 17, 38, 0.97)';
const PANEL_SHADOW_SIDE   = '-4px 0 32px rgba(0,0,0,0.4)';
const PANEL_SHADOW_BOTTOM = '0 -4px 32px rgba(0,0,0,0.45)';

export default function Explorer() {
  // Track breakpoint; initialise synchronously so first render is correct
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);

  const [panelState,   setPanelState]   = useState('collapsed');
  const [selectedReef, setSelectedReef] = useState(null);
  const [vals,         setVals]         = useState(DEFAULT_VALS);
  const [result,       setResult]       = useState(null);
  const [loading,      setLoading]      = useState(false);

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Prediction ──────────────────────────────────────────────────────────────
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

  // Debounced re-predict when sliders move (only while exploring)
  useEffect(() => {
    if (panelState !== 'exploring') return;
    const t = setTimeout(() => runPredict(vals), 300);
    return () => clearTimeout(t);
  }, [vals, panelState, runPredict]);

  // ── Event handlers ───────────────────────────────────────────────────────────
  function handleReefClick(reef) {
    setSelectedReef(reef);
    setPanelState('reef');
  }

  // Any click on the empty map → back to State 1
  function handleMapClick() {
    setSelectedReef(null);
    setPanelState('collapsed');
  }

  function handleExplore() {
    if (!selectedReef) return;
    const newVals = {
      ssta_dhw:        selectedReef.avg_dhw,
      ssta_frequency:  selectedReef.avg_freq,
      ssta:            selectedReef.avg_ssta,
      sst:             selectedReef.avg_sst,
      depth_m:         selectedReef.avg_depth,
      bleaching_level: 'Colony',
      exposure:        selectedReef.exposure,
      ocean:           selectedReef.ocean,
    };
    setVals(newVals);
    setPanelState('exploring');
    runPredict(newVals);
  }

  function handlePresetLoad(preset) {
    const newVals = { ...preset.values, bleaching_level: 'Colony' };
    setVals(newVals);
    setSelectedReef(null);
    runPredict(newVals);
  }

  function handleValChange(key, value) {
    setVals(v => ({ ...v, [key]: parseFloat(value) }));
  }

  // Desktop close (×) → always State 1
  function closeDesktop() {
    setSelectedReef(null);
    setPanelState('collapsed');
  }

  // Mobile handle tap → step down one level
  function collapseMobile() {
    if (panelState === 'exploring') {
      setPanelState(selectedReef ? 'reef' : 'collapsed');
    } else if (panelState === 'reef') {
      setSelectedReef(null);
      setPanelState('collapsed');
    }
  }

  // ── Shared JSX helpers ───────────────────────────────────────────────────────
  function renderReefSummary() {
    if (!selectedReef) return null;
    return (
      <>
        <div style={{ marginBottom: '14px' }}>
          <div style={{ color: 'white', fontSize: '1.1rem', fontWeight: 600 }}>
            {selectedReef.ecoregion}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.8rem', marginTop: '2px' }}>
            {selectedReef.ocean}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
          <StatChip label="Avg bleaching" value={`${selectedReef.avg_bleaching?.toFixed(1)}%`} />
          <StatChip label="Ocean temp"    value={`${selectedReef.avg_sst?.toFixed(1)}°C`} />
          <StatChip label="Stress weeks"  value={`${selectedReef.avg_dhw?.toFixed(1)} wks`} />
        </div>

        <button
          onClick={handleExplore}
          style={{
            background: 'var(--teal)', color: 'white',
            border: 'none', borderRadius: '10px',
            padding: '11px 24px', fontSize: '0.875rem', fontWeight: 600,
            cursor: 'pointer', width: '100%', transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.82'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          Explore this reef — what if? →
        </button>
      </>
    );
  }

  function renderExploringContent() {
    return (
      <>
        <SeverityCard result={result} loading={loading} />
        <div style={{ marginTop: '16px' }}>
          <Sliders vals={vals} onValChange={handleValChange} onPresetLoad={handlePresetLoad} />
        </div>
      </>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', top: '64px', left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>

      {/* Full-screen map — always underneath */}
      <ReefMap
        selectedReef={selectedReef}
        onReefClick={handleReefClick}
        onMapClick={handleMapClick}
      />

      {isDesktop ? (
        // ── Desktop: right-side sliding panel ─────────────────────────────────
        <>
          {/* Tab hint — visible only when panel is off-screen */}
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

          {/* Side panel */}
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
            {/* Header row: label + close button */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '18px 20px 12px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              flexShrink: 0,
            }}>
              <span style={{
                color: 'rgba(255,255,255,0.4)',
                fontSize: '0.7rem', fontWeight: 500, letterSpacing: '0.06em',
              }}>
                {panelState === 'exploring' ? 'WHAT IF?' : 'REEF INFO'}
              </span>
              <button
                onClick={closeDesktop}
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

            {/* Scrollable content area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {panelState === 'reef'      && renderReefSummary()}
              {panelState === 'exploring' && renderExploringContent()}
            </div>
          </div>
        </>
      ) : (
        // ── Mobile: bottom sheet ───────────────────────────────────────────────
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: MOBILE_HEIGHT[panelState],
          background: PANEL_BG,
          backdropFilter: 'blur(16px)',
          borderRadius: '16px 16px 0 0',
          transition: 'height 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
          zIndex: 500,
          boxShadow: PANEL_SHADOW_BOTTOM,
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Drag handle + collapsed hint */}
          <div
            onClick={panelState !== 'collapsed' ? collapseMobile : undefined}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '10px 0 8px',
              cursor: panelState !== 'collapsed' ? 'pointer' : 'default',
              flexShrink: 0,
            }}
          >
            <div style={{
              width: '36px', height: '4px', borderRadius: '2px',
              background: 'rgba(255,255,255,0.2)',
            }} />
            {panelState === 'collapsed' && (
              <span style={{
                color: 'rgba(255,255,255,0.45)', fontSize: '0.78rem',
                marginTop: '6px', letterSpacing: '0.02em',
              }}>
                Click a reef to explore ↑
              </span>
            )}
          </div>

          {/* State 2 — reef summary */}
          {panelState === 'reef' && (
            <div style={{ padding: '2px 24px 20px', flex: 1 }}>
              {renderReefSummary()}
            </div>
          )}

          {/* State 3 — two-column: result | sliders */}
          {panelState === 'exploring' && (
            <div style={{
              flex: 1, overflow: 'hidden',
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: '16px', padding: '4px 20px 16px',
            }}>
              <div style={{ overflowY: 'auto' }}>
                <SeverityCard result={result} loading={loading} />
              </div>
              <div style={{ overflowY: 'auto' }}>
                <Sliders vals={vals} onValChange={handleValChange} onPresetLoad={handlePresetLoad} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatChip({ label, value }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.08)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '8px', padding: '8px 14px',
    }}>
      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.68rem', marginBottom: '3px' }}>
        {label}
      </div>
      <div style={{ color: 'white', fontSize: '0.95rem', fontWeight: 600 }}>
        {value}
      </div>
    </div>
  );
}
