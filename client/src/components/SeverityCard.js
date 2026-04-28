const STYLES = {
  healthy:   { bg: '#d4edda', color: '#155724', bar: '#28a745' },
  stressed:  { bg: '#fff3cd', color: '#856404', bar: '#ffc107' },
  bleaching: { bg: '#fde8d8', color: '#8a3a00', bar: '#fd7e14' },
  severe:    { bg: '#f8d7da', color: '#721c24', bar: '#dc3545' },
  critical:  { bg: '#2d2d2d', color: '#f8f9fa', bar: '#6c757d' },
};

export default function SeverityCard({ result, loading }) {
  if (loading) return (
    <div style={{
      background: 'white', borderRadius: 'var(--radius)',
      padding: '2rem', textAlign: 'center', color: 'var(--gray-600)'
    }}>
      Calculating...
    </div>
  );
  if (!result) return null;

  const { severity, probability, severity_level, plain_text, dhw_context, historical_context } = result;
  const key   = severity_level?.key || 'healthy';
  const style = STYLES[key] || STYLES.healthy;
  const dhwPct = Math.min((result.dhw_value || 0) / 20, 1) * 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* Main severity card */}
      <div style={{
        background: style.bg, color: style.color,
        borderRadius: 'var(--radius)', padding: '1.5rem',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '6px' }}>{severity_level?.icon}</div>
        <div style={{ fontSize: '1rem', fontWeight: 500, marginBottom: '4px' }}>{severity_level?.label}</div>
        <div style={{ fontSize: '2.2rem', fontWeight: 600, marginBottom: '6px' }}>
          {severity?.toFixed(0)}% bleaching
        </div>
        <div style={{ fontSize: '0.82rem', opacity: 0.85, lineHeight: 1.4 }}>
          {severity_level?.description}
        </div>
      </div>

      {/* Plain English */}
      <p style={{
        fontSize: '0.9rem', color: 'var(--gray-900)',
        fontStyle: 'italic', lineHeight: 1.5,
        background: 'white', borderRadius: 'var(--radius)',
        padding: '12px 16px',
      }}>
        {plain_text}
      </p>

      {/* Thermal stress bar */}
      <div style={{
        background: 'white', borderRadius: 'var(--radius)', padding: '14px 16px',
      }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--gray-600)', marginBottom: '8px' }}>
          Thermal stress level
        </div>
        <div style={{
          background: 'var(--gray-200)', borderRadius: '6px',
          height: '8px', overflow: 'hidden', marginBottom: '8px'
        }}>
          <div style={{
            width: `${dhwPct}%`, background: style.bar,
            height: '100%', borderRadius: '6px',
            transition: 'width 0.4s ease'
          }} />
        </div>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontSize: '0.7rem', color: '#adb5bd'
        }}>
          <span>None</span>
          <span>Bleaching (4 wks)</span>
          <span>Mortality (8 wks)</span>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--gray-600)', marginTop: '8px' }}>
          {dhw_context}
        </p>
      </div>

      {/* Historical context */}
      {historical_context && (
        <div style={{
          background: '#e8f4f8', borderRadius: 'var(--radius)',
          padding: '12px 16px', fontSize: '0.82rem',
          color: '#0c5460', lineHeight: 1.5,
          borderLeft: '3px solid var(--teal)'
        }}>
          📚 {historical_context.n} real observations in the <strong>{historical_context.ocean}</strong> with
          similar thermal stress averaged <strong>{historical_context.avg_pct}%</strong> bleaching historically.
        </div>
      )}

      {/* Probability chip */}
      <div style={{ fontSize: '0.75rem', color: 'var(--gray-600)', textAlign: 'right' }}>
        Bleaching probability: <strong>{(probability * 100).toFixed(0)}%</strong>
      </div>
    </div>
  );
}
