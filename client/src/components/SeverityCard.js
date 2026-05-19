// Severity styles using Notion design system pastel tints
const STYLES = {
  healthy:   { bg: 'var(--tint-mint)',    color: 'var(--success)',       dot: '#1aae39' },
  stressed:  { bg: 'var(--tint-yellow)',  color: 'var(--brand-orange)',  dot: '#dd5b00' },
  bleaching: { bg: 'var(--tint-peach)',   color: 'var(--brand-orange)',  dot: '#dd5b00' },
  severe:    { bg: 'var(--tint-rose)',    color: 'var(--error)',         dot: '#e03131' },
  critical:  { bg: 'var(--surface)',      color: 'var(--slate)',         dot: '#a4a097' },
};

export default function SeverityCard({ result, loading, label }) {
  if (loading) return (
    <div style={{ padding: '14px 0', textAlign: 'center', color: 'var(--stone)', fontSize: '0.8125rem' }}>
      Calculating…
    </div>
  );
  if (!result) return null;

  const { severity, probability, severity_level, plain_text } = result;
  const key   = severity_level?.key || 'healthy';
  const style = STYLES[key] || STYLES.healthy;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

      {/* Result block */}
      <div style={{
        background: style.bg,
        borderRadius: 'var(--radius-lg)',
        padding: '14px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <span style={{ fontSize: '1.3rem', lineHeight: 1, flexShrink: 0 }}>
            {severity_level?.icon}
          </span>
          <div>
            <div style={{
              fontSize: '0.6875rem', color: style.color, fontWeight: 500,
              lineHeight: 1, marginBottom: '3px', opacity: 0.8,
            }}>
              {label || severity_level?.label}
            </div>
            <div style={{
              fontSize: '1.75rem', fontWeight: 700, lineHeight: 1,
              color: style.color,
            }}>
              {severity?.toFixed(0)}% bleaching
            </div>
          </div>
        </div>

        <p style={{
          margin: 0,
          fontSize: '0.8125rem', fontStyle: 'italic',
          color: style.color, opacity: 0.8,
          lineHeight: 1.5,
        }}>
          {plain_text}
        </p>
      </div>

      {/* Probability */}
      <div style={{ fontSize: '0.6875rem', color: 'var(--stone)', textAlign: 'right' }}>
        Bleaching probability:{' '}
        <strong style={{ color: 'var(--slate)' }}>
          {(probability * 100).toFixed(0)}%
        </strong>
      </div>
    </div>
  );
}
