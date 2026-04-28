import { useState } from 'react';
import ReefMap from './ReefMap';
import Sliders from './Sliders';

export default function Explorer() {
  const [selectedReef, setSelectedReef] = useState(null);

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: '1400px', margin: '0 auto' }}>

      {/* Hero */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{
          color: 'white', fontSize: '1.6rem', fontWeight: 400,
          letterSpacing: '-0.03em', marginBottom: '6px',
        }}>
          What happens to coral reefs when the ocean warms?
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.9rem', lineHeight: 1.5 }}>
          Search for a reef and adjust the conditions to see the impact on coral bleaching —
          or load a real historical event to explore what actually happened.
        </p>
      </div>

      {/* Two-column layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 420px',
        gap: '1.5rem',
        alignItems: 'start',
      }}>

        {/* Left — Map */}
        <div style={{
          background: 'white', borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow)', overflow: 'hidden',
          height: 'calc(100vh - 160px)',
          position: 'sticky', top: '80px',
        }}>
          <ReefMap selectedReef={selectedReef} />
        </div>

        {/* Right — Controls + Result */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '0',
          maxHeight: 'calc(100vh - 160px)',
          overflowY: 'auto',
          paddingRight: '4px',
        }}>
          <Sliders onReefSelect={setSelectedReef} />
        </div>

      </div>
    </div>
  );
}
