import { useFetch } from '../hooks/useFetch';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';

const EVENTS = [
  {
    year: '1998',
    title: 'First global mass bleaching',
    ocean: 'Global',
    dhw: 12,
    bleaching: 46,
    color: '#e74c3c',
    desc: 'The strongest El Niño on record drove ocean temperatures to extremes worldwide. 16% of the world\'s coral reefs were killed in a single year — the first truly global bleaching event ever recorded.',
  },
  {
    year: '2002',
    title: 'Great Barrier Reef crisis',
    ocean: 'Pacific',
    dhw: 8,
    bleaching: 60,
    color: '#e74c3c',
    desc: 'The Great Barrier Reef experienced its worst bleaching event to that point, with 60% of inshore reefs affected. It was a warning that the GBR\'s resilience was beginning to fail.',
  },
  {
    year: '2010',
    title: 'Caribbean & Southeast Asia hit hard',
    ocean: 'Atlantic / Indo-Pacific',
    dhw: 9,
    bleaching: 38,
    color: '#f39c12',
    desc: 'A La Niña-boosted warming event caused severe bleaching across the Caribbean and Southeast Asia. Some reefs in Indonesia recorded 80% coral death.',
  },
  {
    year: '2016',
    title: 'Worst bleaching in history',
    ocean: 'Global',
    dhw: 16,
    bleaching: 67,
    color: '#e74c3c',
    desc: 'An unprecedented marine heatwave — supercharged by El Niño and long-term warming — killed 50% of shallow-water corals on the Great Barrier Reef\'s northern section. Two-thirds of global reefs were affected.',
  },
  {
    year: '2024',
    title: 'Fourth global bleaching event',
    ocean: 'Global',
    dhw: 14,
    bleaching: 54,
    color: '#e74c3c',
    desc: 'NOAA confirmed the fourth global bleaching event in recorded history, affecting reefs in every ocean basin. Record sea surface temperatures — the hottest since satellite records began — drove the crisis.',
  },
];

const CARD = {
  background: 'white', borderRadius: 'var(--radius)',
  padding: '1.5rem', boxShadow: 'var(--shadow)',
};

export default function Science() {
  const { data: timeseries, loading: tsLoading } = useFetch('/api/timeseries');
  const { data: reefs,      loading: rfLoading  } = useFetch('/api/reefs');

  const topReefs = reefs
    ?.sort((a, b) => b.avg_bleaching - a.avg_bleaching)
    .slice(0, 12)
    .map(r => ({ name: r.ecoregion.length > 28 ? r.ecoregion.slice(0, 26) + '…' : r.ecoregion, value: +r.avg_bleaching.toFixed(1) }));

  return (
    <div style={{ background: 'linear-gradient(180deg, #0a1628 0%, #0d2137 40%, #0a3352 100%)', minHeight: '100vh', paddingBottom: '3rem' }}>
      <div style={{ padding: '1.5rem 2rem', maxWidth: '1200px', margin: '0 auto' }}>

      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ color: 'white', fontSize: '1.4rem', fontWeight: 400, letterSpacing: '-0.03em', marginBottom: '6px' }}>
          40 years of coral bleaching data
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.875rem' }}>
          23,203 observations collected between 1980 and 2020 across 5 ocean basins.
          Curious about how the predictions work? It's all here.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Key moments */}
        <div>
          <h2 style={{ color: 'white', fontSize: '1rem', fontWeight: 500, marginBottom: '12px' }}>
            Key moments in coral bleaching history
          </h2>
          <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '8px' }}>
            {EVENTS.map(({ year, title, ocean, dhw, bleaching, color, desc }) => (
              <div key={year} style={{
                flex: '0 0 240px',
                background: 'rgba(255,255,255,0.05)',
                border: `1px solid ${color}44`,
                borderTop: `3px solid ${color}`,
                borderRadius: '10px',
                padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                  <span style={{ fontSize: '1.3rem', fontWeight: 700, color, lineHeight: 1 }}>{year}</span>
                  <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.04em' }}>{ocean}</span>
                </div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'white', marginBottom: '8px', lineHeight: 1.3 }}>{title}</div>
                <p style={{ margin: '0 0 10px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.55 }}>{desc}</p>
                <div style={{ display: 'flex', gap: '10px', fontSize: '0.7rem' }}>
                  <span style={{ color: 'rgba(255,255,255,0.35)' }}>DHW: <strong style={{ color: 'rgba(255,255,255,0.65)' }}>{dhw} wks</strong></span>
                  <span style={{ color: 'rgba(255,255,255,0.35)' }}>Bleaching: <strong style={{ color }}>{bleaching}%</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Temporal trend */}
        <div style={CARD}>
          <h2 style={{ fontSize: '1rem', fontWeight: 500, marginBottom: '4px' }}>
            Bleaching over time
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--gray-600)', marginBottom: '1rem', lineHeight: 1.5 }}>
            Two El Niño events — in 1998 and 2016 — caused the worst mass bleaching events in history.
            El Niño raises ocean temperatures globally, pushing corals beyond their thermal tolerance.
          </p>
          {tsLoading ? <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-600)' }}>Loading...</div> : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={timeseries} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v, n) => [`${v.toFixed(1)}%`, n]} />
                <ReferenceLine x={1998} stroke="#adb5bd" strokeDasharray="4 2" label={{ value: 'El Niño 1998', position: 'top', fontSize: 10, fill: '#6c757d' }} />
                <ReferenceLine x={2016} stroke="#adb5bd" strokeDasharray="4 2" label={{ value: 'El Niño 2016', position: 'top', fontSize: 10, fill: '#6c757d' }} />
                <Line type="monotone" dataKey="avg_bleaching" name="Avg % bleaching" stroke="#e07a5f" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
          <p style={{ fontSize: '0.75rem', color: '#adb5bd', marginTop: '8px' }}>
            ⚠️ Pre-1998 data is sparse — fewer than 30 observations per year before 1997.
          </p>
        </div>

        {/* Two columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

          {/* DHW chart */}
          <div style={CARD}>
            <h2 style={{ fontSize: '1rem', fontWeight: 500, marginBottom: '4px' }}>
              Why thermal stress weeks matter
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--gray-600)', marginBottom: '1rem', lineHeight: 1.5 }}>
              Degree Heating Weeks (DHW) measure how long the ocean has been dangerously warm.
              Once DHW crosses 4 weeks, bleaching begins. Above 8 weeks, corals start dying.
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={[
                  { name: 'No stress',   value: 1.2  },
                  { name: '0–4 weeks',   value: 8.4  },
                  { name: '4–8 weeks',   value: 22.1 },
                  { name: '8–12 weeks',  value: 38.6 },
                  { name: '>12 weeks',   value: 54.3 },
                ]}
                margin={{ top: 5, right: 10, bottom: 5, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={v => [`${v}%`, 'Avg bleaching']} />
                <Bar dataKey="value" fill="#f2cc8f" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top ecoregions */}
          <div style={CARD}>
            <h2 style={{ fontSize: '1rem', fontWeight: 500, marginBottom: '4px' }}>
              Most affected reefs
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--gray-600)', marginBottom: '1rem', lineHeight: 1.5 }}>
              Average bleaching across all observations for each ecoregion (min. 20 observations).
            </p>
            {rfLoading ? <div style={{ height: 220 }} /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  layout="vertical"
                  data={topReefs}
                  margin={{ top: 0, right: 20, bottom: 0, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={v => [`${v}%`, 'Avg bleaching']} />
                  <Bar dataKey="value" fill="#e07a5f" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* How the model works */}
        <div style={CARD}>
          <h2 style={{ fontSize: '1rem', fontWeight: 500, marginBottom: '1rem' }}>
            How the prediction model works
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: '8px', color: 'var(--ocean)' }}>
                Two-stage approach
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--gray-600)', lineHeight: 1.6 }}>
                Nearly 40% of all coral observations show 0% bleaching — so a single model
                would be biased toward predicting "not much" all the time.
                <br /><br />
                Instead, the model uses two stages:
              </p>
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { n: '1', label: 'Is bleaching happening?', desc: 'A classifier decides: yes or no.' },
                  { n: '2', label: 'How severe is it?', desc: 'If yes, a second model estimates 0–100%.' },
                ].map(({ n, label, desc }) => (
                  <div key={n} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <div style={{
                      width: '22px', height: '22px', borderRadius: '50%',
                      background: 'var(--ocean)', color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.72rem', fontWeight: 600, flexShrink: 0,
                    }}>{n}</div>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 500 }}>{label}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--gray-600)' }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: '8px', color: 'var(--ocean)' }}>
                What the model relies on
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[
                  { label: 'Thermal stress weeks (DHW)', pct: 95, desc: 'Strongest predictor' },
                  { label: 'Temp above normal (SSTA)',   pct: 82, desc: 'Consistent with science' },
                  { label: 'Stress frequency',           pct: 68, desc: 'Chronic vs acute' },
                  { label: 'Ocean temperature',          pct: 55, desc: 'Absolute baseline' },
                  { label: 'Depth',                      pct: 38, desc: 'Deeper = more exposed' },
                ].map(({ label, pct, desc }) => (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '3px' }}>
                      <span style={{ fontWeight: 500 }}>{label}</span>
                      <span style={{ color: 'var(--gray-600)' }}>{desc}</span>
                    </div>
                    <div style={{ background: 'var(--gray-200)', borderRadius: '4px', height: '6px' }}>
                      <div style={{ width: `${pct}%`, background: 'var(--ocean)', borderRadius: '4px', height: '100%' }} />
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: '0.72rem', color: '#adb5bd', marginTop: '10px' }}>
                Trained on XGBoost. Evaluated on 2016–2020 data (temporal split).
              </p>
            </div>
          </div>
        </div>

      </div>

      <div style={{ marginTop: '1.5rem', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem' }}>
        Data: Global Coral Reef Monitoring Network · 23,203 observations · 1980–2020
      </div>
      </div>
    </div>
  );
}
