export default function Nav({ page, setPage }) {
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: 'rgba(26,26,46,0.95)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      height: '64px',
      display: 'flex', alignItems: 'center',
      padding: '0 2rem', gap: '2rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginRight: 'auto' }}>
        <span style={{ fontSize: '1.4rem' }}>🪸</span>
        <span style={{ color: 'white', fontWeight: 500, fontSize: '1rem', letterSpacing: '-0.02em' }}>
          Coral Bleaching Monitor
        </span>
      </div>

      {[
        { id: 'explorer', label: 'Explore Reefs' },
        { id: 'science',  label: 'Data & Science' },
      ].map(({ id, label }) => (
        <button key={id} onClick={() => setPage(id)} style={{
          background: page === id ? 'rgba(255,255,255,0.12)' : 'transparent',
          border: page === id ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent',
          color: page === id ? 'white' : 'rgba(255,255,255,0.5)',
          padding: '7px 18px', borderRadius: '20px',
          fontSize: '0.875rem', fontWeight: 500,
          cursor: 'pointer', transition: 'all 0.2s',
        }}>
          {label}
        </button>
      ))}
    </nav>
  );
}
