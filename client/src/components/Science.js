import { useFetch } from '../hooks/useFetch';
import { API } from '../api';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

const EVENTS = [
  {
    year: '1998',
    title: 'First global mass bleaching',
    ocean: 'Global',
    dhw: 12,
    bleaching: 46,
    tint: 'var(--tint-rose)',
    accent: 'var(--error)',
    desc: "The strongest El Niño on record drove ocean temperatures to extremes worldwide. 16% of the world's coral reefs were killed in a single year — the first truly global bleaching event ever recorded.",
  },
  {
    year: '2002',
    title: 'Great Barrier Reef crisis',
    ocean: 'Pacific',
    dhw: 8,
    bleaching: 60,
    tint: 'var(--tint-rose)',
    accent: 'var(--error)',
    desc: "The Great Barrier Reef experienced its worst bleaching event to that point, with 60% of inshore reefs affected. It was a warning that the GBR's resilience was beginning to fail.",
  },
  {
    year: '2010',
    title: 'Caribbean & Southeast Asia hit hard',
    ocean: 'Atlantic / Indo-Pacific',
    dhw: 9,
    bleaching: 38,
    tint: 'var(--tint-peach)',
    accent: 'var(--brand-orange)',
    desc: 'A La Niña-boosted warming event caused severe bleaching across the Caribbean and Southeast Asia. Some reefs in Indonesia recorded 80% coral death.',
  },
  {
    year: '2016',
    title: 'Worst bleaching in history',
    ocean: 'Global',
    dhw: 16,
    bleaching: 67,
    tint: 'var(--tint-rose)',
    accent: 'var(--error)',
    desc: "An unprecedented marine heatwave — supercharged by El Niño and long-term warming — killed 50% of shallow-water corals on the Great Barrier Reef's northern section. Two-thirds of global reefs were affected.",
  },
  {
    year: '2024',
    title: 'Fourth global bleaching event',
    ocean: 'Global',
    dhw: 14,
    bleaching: 54,
    tint: 'var(--tint-rose)',
    accent: 'var(--error)',
    desc: 'NOAA confirmed the fourth global bleaching event in recorded history, affecting reefs in every ocean basin. Record sea surface temperatures — the hottest since satellite records began — drove the crisis.',
  },
];

const CARD = {
  background: 'var(--surface-1)',
  borderRadius: 'var(--radius-lg)',
  padding: '1.5rem',
  border: '1px solid var(--hairline)',
};

export default function Science() {
  const { data: timeseries, loading: tsLoading } = useFetch(API.timeseries);
  const { data: reefs,      loading: rfLoading  } = useFetch(API.reefs);

  const topReefs = reefs
    ?.sort((a, b) => b.avg_bleaching - a.avg_bleaching)
    .slice(0, 12)
    .map(r => ({
      name: r.ecoregion.length > 28 ? r.ecoregion.slice(0, 26) + '…' : r.ecoregion,
      value: +r.avg_bleaching.toFixed(1),
    }));

  return (
    <div style={{ background: 'var(--canvas)', minHeight: '100vh', paddingBottom: '4rem' }}>

      {/* ── Hero dark strip ─────────────────────────────────────────────────────── */}
      <div style={{ background: 'var(--inverse-canvas)', padding: '64px 2rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{
            display: 'inline-block',
            background: 'rgba(255,255,255,0.10)',
            color: 'rgba(255,255,255,0.70)',
            fontSize: '0.875rem', fontWeight: 500,
            padding: '4px 12px', borderRadius: 'var(--radius-pill)',
            marginBottom: '20px',
          }}>
            Data & Science
          </div>
          <h1 style={{
            fontSize: '2.75rem', fontWeight: 500, lineHeight: 1.10,
            letterSpacing: '-1px', color: 'var(--inverse-ink)',
            marginBottom: '16px', maxWidth: '640px',
          }}>
            40 years of coral bleaching data
          </h1>
          <p style={{
            fontSize: '1.125rem', fontWeight: 400, lineHeight: 1.55,
            color: 'var(--inverse-ink-muted)', maxWidth: '520px',
          }}>
            23,203 observations across 5 ocean basins, 1980–2020.
            Explore the data and see how the prediction model works.
          </p>
        </div>
      </div>

      <div style={{ padding: '2rem 2rem 0', maxWidth: '1200px', margin: '0 auto', paddingTop: '2.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Key moments — card-feature-* variants */}
          <div>
            <p style={{
              fontSize: '14px', fontWeight: 500,
              color: 'var(--ink-subtle)', marginBottom: '12px',
            }}>
              Key moments in coral bleaching history
            </p>
            <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
              {EVENTS.map(({ year, title, ocean, dhw, bleaching, tint, accent, desc }) => (
                <div key={year} style={{
                  flex: '0 0 240px',
                  background: 'var(--surface-1)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--hairline)',
                  borderTop: `3px solid ${accent}`,
                  padding: '20px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{
                      fontSize: '1.375rem', fontWeight: 700, color: accent, lineHeight: 1,
                      letterSpacing: '-0.5px',
                    }}>{year}</span>
                    <span style={{
                      fontSize: '12px', fontWeight: 500,
                      color: 'var(--ink-subtle)',
                    }}>{ocean}</span>
                  </div>
                  <div style={{
                    fontSize: '0.875rem', fontWeight: 600,
                    color: 'var(--charcoal)', marginBottom: '10px', lineHeight: 1.30,
                  }}>{title}</div>
                  <p style={{
                    margin: '0 0 12px',
                    fontSize: '0.8125rem', color: 'var(--slate)', lineHeight: 1.55,
                  }}>{desc}</p>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem' }}>
                    <span style={{ color: 'var(--stone)' }}>DHW: <strong style={{ color: 'var(--charcoal)' }}>{dhw} wks</strong></span>
                    <span style={{ color: 'var(--stone)' }}>Bleaching: <strong style={{ color: accent }}>{bleaching}%</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Temporal trend */}
          <div style={CARD}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '4px', color: 'var(--ink)' }}>
              Bleaching over time
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--slate)', marginBottom: '1.25rem', lineHeight: 1.55 }}>
              Two El Niño events — in 1998 and 2016 — caused the worst mass bleaching events in history.
              El Niño raises ocean temperatures globally, pushing corals beyond their thermal tolerance.
            </p>
            {tsLoading
              ? <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--stone)' }}>Loading…</div>
              : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={timeseries} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" />
                    <XAxis dataKey="year" tick={{ fontSize: 11, fill: 'var(--stone)' }} />
                    <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: 'var(--stone)' }} />
                    <Tooltip
                      contentStyle={{ background: 'var(--canvas)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem' }}
                      formatter={(v, n) => [`${v.toFixed(1)}%`, n]}
                    />
                    <ReferenceLine x={1998} stroke="var(--hairline-strong)" strokeDasharray="4 2"
                      label={{ value: 'El Niño 1998', position: 'top', fontSize: 10, fill: 'var(--stone)' }} />
                    <ReferenceLine x={2016} stroke="var(--hairline-strong)" strokeDasharray="4 2"
                      label={{ value: 'El Niño 2016', position: 'top', fontSize: 10, fill: 'var(--stone)' }} />
                    <Line type="monotone" dataKey="avg_bleaching" name="Avg % bleaching"
                      stroke="var(--brand-orange)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '8px' }}>
              ⚠️ Pre-1998 data is sparse — fewer than 30 observations per year before 1997.
            </p>
          </div>

          {/* Two-column charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

            <div style={CARD}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '4px', color: 'var(--ink)' }}>
                Why thermal stress weeks matter
              </h2>
              <p style={{ fontSize: '0.8125rem', color: 'var(--slate)', marginBottom: '1.25rem', lineHeight: 1.55 }}>
                Degree Heating Weeks (DHW) measure how long the ocean has been dangerously warm.
                Once DHW crosses 4 weeks, bleaching begins. Above 8 weeks, corals start dying.
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={[
                    { name: 'No stress',  value: 1.2  },
                    { name: '0–4 weeks',  value: 8.4  },
                    { name: '4–8 weeks',  value: 22.1 },
                    { name: '8–12 weeks', value: 38.6 },
                    { name: '>12 weeks',  value: 54.3 },
                  ]}
                  margin={{ top: 5, right: 10, bottom: 5, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--stone)' }} />
                  <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: 'var(--stone)' }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--canvas)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem' }}
                    formatter={v => [`${v}%`, 'Avg bleaching']}
                  />
                  <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={CARD}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '4px', color: 'var(--ink)' }}>
                Most affected reefs
              </h2>
              <p style={{ fontSize: '0.8125rem', color: 'var(--slate)', marginBottom: '1.25rem', lineHeight: 1.55 }}>
                Average bleaching across all observations for each ecoregion (min. 20 observations).
              </p>
              {rfLoading ? <div style={{ height: 220 }} /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    layout="vertical"
                    data={topReefs}
                    margin={{ top: 0, right: 20, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" horizontal={false} />
                    <XAxis type="number" tickFormatter={v => `${v}%`} tick={{ fontSize: 10, fill: 'var(--stone)' }} />
                    <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10, fill: 'var(--stone)' }} />
                    <Tooltip
                      contentStyle={{ background: 'var(--canvas)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem' }}
                      formatter={v => [`${v}%`, 'Avg bleaching']}
                    />
                    <Bar dataKey="value" fill="var(--brand-orange)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* How the model works */}
          <div style={CARD}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem', color: 'var(--ink)' }}>
              How the prediction model works
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              <div>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px', color: 'var(--primary)' }}>
                  Two-stage approach
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--slate)', lineHeight: 1.6 }}>
                  Nearly 40% of all coral observations show 0% bleaching — so a single model
                  would be biased toward predicting "not much" all the time.
                  <br /><br />
                  Instead, the model uses two stages:
                </p>
                <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { n: '1', label: 'Is bleaching happening?', desc: 'A classifier decides: yes or no.' },
                    { n: '2', label: 'How severe is it?',       desc: 'If yes, a second model estimates 0–100%.' },
                  ].map(({ n, label, desc }) => (
                    <div key={n} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <div style={{
                        width: '24px', height: '24px', borderRadius: 'var(--radius-full)',
                        background: 'var(--primary)', color: 'var(--on-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.72rem', fontWeight: 600, flexShrink: 0,
                      }}>{n}</div>
                      <div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--ink)' }}>{label}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--slate)', marginTop: '2px' }}>{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '12px', color: 'var(--primary)' }}>
                  What the model relies on
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { label: 'Thermal stress weeks (DHW)', pct: 95, desc: 'Strongest predictor' },
                    { label: 'Temp above normal (SSTA)',   pct: 82, desc: 'Consistent with science' },
                    { label: 'Stress frequency',           pct: 68, desc: 'Chronic vs acute' },
                    { label: 'Ocean temperature',          pct: 55, desc: 'Absolute baseline' },
                    { label: 'Depth',                      pct: 38, desc: 'Deeper = more exposed' },
                  ].map(({ label, pct, desc }) => (
                    <div key={label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 500, color: 'var(--charcoal)' }}>{label}</span>
                        <span style={{ color: 'var(--stone)', fontSize: '0.75rem' }}>{desc}</span>
                      </div>
                      <div style={{ background: 'var(--hairline)', borderRadius: 'var(--radius-xs)', height: '6px' }}>
                        <div style={{ width: `${pct}%`, background: 'var(--primary)', borderRadius: 'var(--radius-xs)', height: '100%' }} />
                      </div>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '12px' }}>
                  Trained on XGBoost. Evaluated on 2016–2020 data (temporal split).
                </p>
              </div>
            </div>
          </div>

        </div>

        <div style={{ marginTop: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.75rem' }}>
          Data: Global Coral Reef Monitoring Network · 23,203 observations · 1980–2020
        </div>
      </div>
    </div>
  );
}
