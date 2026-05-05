// Severity styles tuned for the dark panel background
const STYLES = {
  healthy:   { bg: 'rgba(46, 204, 113, 0.14)', color: '#6ee7b7', bar: '#2ecc71' },
  stressed:  { bg: 'rgba(243, 156, 18, 0.14)', color: '#fcd34d', bar: '#f39c12' },
  bleaching: { bg: 'rgba(231, 76, 60, 0.14)',  color: '#fca5a5', bar: '#e74c3c' },
  severe:    { bg: 'rgba(192, 57, 43, 0.22)',  color: '#fca5a5', bar: '#e74c3c' },
  critical:  { bg: 'rgba(255,255,255,0.06)',   color: 'rgba(255,255,255,0.75)', bar: '#6c757d' },
};

export default function SeverityCard({ result, loading, label }) {
  if (loading) return (
    <div style={{ padding: '14px 0', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem' }}>
      Calculating…
    </div>
  );
  if (!result) return null;

  const { severity, probability, severity_level, plain_text } = result;
  const key   = severity_level?.key || 'healthy';
  const style = STYLES[key] || STYLES.healthy;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

      {/* ── Compact result block ── */}
      <div style={{
        background: style.bg,
        borderRadius: 'var(--radius)',
        padding: '12px 14px',
      }}>
        {/* Single row: icon + label / percentage */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <span style={{ fontSize: '1.4rem', lineHeight: 1, flexShrink: 0 }}>
            {severity_level?.icon}
          </span>
          <div>
            <div style={{
              fontSize: '0.72rem', color: style.color, opacity: 0.65,
              lineHeight: 1, marginBottom: '3px',
            }}>
              {label || severity_level?.label}
            </div>
            <div style={{
              fontSize: '1.8rem', fontWeight: 700, lineHeight: 1,
              color: style.color,
            }}>
              {severity?.toFixed(0)}% bleaching
            </div>
          </div>
        </div>

        {/* Plain English — same background, no separate box */}
        <p style={{
          margin: 0,
          fontSize: '0.8rem', fontStyle: 'italic',
          color: style.color, opacity: 0.75,
          lineHeight: 1.45,
        }}>
          {plain_text}
        </p>
      </div>

      {/* ── Probability ── */}
      <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', textAlign: 'right' }}>
        Bleaching probability:{' '}
        <strong style={{ color: 'rgba(255,255,255,0.55)' }}>
          {(probability * 100).toFixed(0)}%
        </strong>
      </div>
    </div>
  );
}
