import { useState } from 'react';

export default function WelcomeModal() {
  const [open, setOpen] = useState(true);

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        background: 'var(--surface-1)',
        borderRadius: 'var(--radius-lg)',
        padding: '2rem',
        maxWidth: '440px',
        width: '100%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🪸</div>

        <h2 style={{
          fontSize: '1.125rem',
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: 'var(--ink)',
          margin: '0 0 0.5rem',
        }}>
          Coral Bleaching Monitor
        </h2>

        <p style={{
          fontSize: '0.875rem',
          color: 'var(--ink-muted)',
          lineHeight: 1.6,
          margin: '0 0 1.25rem',
        }}>
          Explore global coral bleaching events and predict bleaching risk using real environmental data.
        </p>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          marginBottom: '1.5rem',
        }}>
          {[
            { icon: '🗺️', text: 'Explore Reefs — click any reef dot on the map to load its historical bleaching data' },
            { icon: '🎛️', text: 'Adjust sliders — tune sea temperature, depth and exposure to predict bleaching risk' },
            { icon: '📊', text: 'Data & Science — explore global bleaching trends and historical events' },
          ].map(({ icon, text }) => (
            <div key={icon} style={{
              display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
              padding: '0.625rem 0.75rem',
              background: 'var(--surface-2)',
              borderRadius: 'var(--radius-sm)',
            }}>
              <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: '0.05rem' }}>{icon}</span>
              <span style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)', lineHeight: 1.5 }}>{text}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => setOpen(false)}
          style={{
            width: '100%',
            padding: '0.625rem 1rem',
            background: 'var(--ink)',
            color: 'var(--inverse-ink)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: 'pointer',
            letterSpacing: '-0.01em',
          }}
        >
          Start exploring
        </button>
      </div>
    </div>
  );
}
