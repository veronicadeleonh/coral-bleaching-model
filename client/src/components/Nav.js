export default function Nav({ page, setPage }) {
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: 'var(--canvas)',
      borderBottom: '1px solid var(--hairline)',
      height: '56px',
      display: 'flex', alignItems: 'center',
      padding: '0 2rem', gap: '1.5rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginRight: 'auto' }}>
        <span style={{ fontSize: '1.2rem' }}>🪸</span>
        <span style={{
          color: 'var(--ink)',
          fontWeight: 500, fontSize: '0.9375rem',
          letterSpacing: '-0.02em',
        }}>
          Coral Bleaching Monitor
        </span>
      </div>

      {[
        { id: 'explorer', label: 'Explore Reefs' },
        { id: 'science',  label: 'Data & Science' },
      ].map(({ id, label }) => (
        <button key={id} onClick={() => setPage(id)} style={{
          background:   page === id ? 'var(--ink)' : 'transparent',
          border:       page === id ? 'none' : '1px solid var(--hairline)',
          color:        page === id ? 'var(--inverse-ink)' : 'var(--ink-muted)',
          padding:      '7px 16px',
          borderRadius: 'var(--radius-md)',
          fontSize:     '0.875rem', fontWeight: 500,
          cursor:       'pointer', transition: 'all 0.15s',
          letterSpacing: '-0.01em',
        }}>
          {label}
        </button>
      ))}
    </nav>
  );
}
