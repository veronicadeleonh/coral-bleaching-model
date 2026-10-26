import { useEffect, useRef, useState } from 'react';

const H = 170, TOP = 26, AXIS = 138, YMAX = 14;
const MONO = 'IBM Plex Mono, monospace';

// Drawer at the bottom: the worldwide share of surveys with bleaching, per year, as a line chart.
// Event years are highlighted; hovering or picking a year shows its note in a floating tooltip.
export default function Timeline({ t, years, global, year, open, onToggle, onPickYear }) {
  const chartRef = useRef(null);
  const [W, setW] = useState(0);
  const [hover, setHover] = useState(null);
  useEffect(() => {
    const el = chartRef.current;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el); setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const narrow = W < 600;
  const plotW = W * (narrow ? 0.8 : 0.84), afterX0 = plotW + (narrow ? 10 : 24);
  const step = plotW / years.length;
  const x = (i) => step * (i + 0.5);
  const y = (v) => AXIS - (v / YMAX) * (AXIS - TOP - 8);
  const pts = years.map((yr, i) => [x(i), y(global[yr][0])]);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const sel = year ? years.indexOf(year) : -1;
  const tipYear = hover ?? year;
  const ti = tipYear ? years.indexOf(tipYear) : -1;
  const fs = narrow ? 9 : 11;

  const band = (i0, i1, label, key) => {
    const x0 = x(i0) - step / 2 + 2, x1 = x(i1) + step / 2 - 2;
    return (
      <g key={key}>
        <rect x={x0} y={TOP - 6} width={x1 - x0} height={AXIS - TOP + 6} fill="var(--violet)" opacity="0.1" />
        <rect x={x0} y={TOP - 6} width={x1 - x0} height="4" fill="var(--violet)" />
        <text x={x0} y={TOP - 12} fontFamily={MONO} fontSize={fs} letterSpacing="0.06em" fill="var(--fg)">{label}</text>
      </g>
    );
  };
  const names = narrow ? t.tlGlobalShort : t.tlGlobal;

  return (
    <section className="drawer" data-open={open} aria-label={t.timeline}>
      <button type="button" className="tab" aria-expanded={open} onClick={onToggle}>{t.timeline} {open ? '▾' : '▴'}</button>
      <div inert={open ? undefined : ''}>
        <div className="drawer__head"><b>{t.tlTitle}</b><span>{t.tlCaption}</span></div>
        <div className="chart" ref={chartRef}>
          {W > 0 && (
            <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
              {band(7, 7, names[0], 'b2')}{band(11, 14, names[1], 'b3')}
              <rect x={afterX0} y={TOP - 6} width={W - afterX0} height={AXIS - TOP + 6} fill="var(--violet)" opacity="0.1" />
              <rect x={afterX0} y={TOP - 6} width={W - afterX0} height="4" fill="var(--violet)" />
              <text x={afterX0} y={TOP - 12} fontFamily={MONO} fontSize={fs} letterSpacing="0.06em" fill="var(--fg)">{names[2]}</text>
              {!narrow && (
                <text x={(afterX0 + W) / 2} y={(TOP + AXIS) / 2} textAnchor="middle" fontSize="13" fill="var(--fg)">
                  {t.tlAfter.map((l, i) => <tspan key={l} x={(afterX0 + W) / 2} dy={i ? 17 : 0}>{l}</tspan>)}
                </text>
              )}
              {[5, 10].map((v) => (
                <g key={v}>
                  <line x1="0" x2={plotW} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray="2 4" />
                  <text x="0" y={y(v) - 4} fontFamily={MONO} fontSize="10" fill="var(--muted)">{v}%</text>
                </g>
              ))}
              <line x1="0" x2={plotW} y1={AXIS} y2={AXIS} stroke="var(--muted)" />
              <line x1={afterX0} x2={W - 6} y1={AXIS} y2={AXIS} stroke="var(--muted)" strokeDasharray="4 4" />
              <path d={`M${W - 12} ${AXIS - 5} L${W - 6} ${AXIS} L${W - 12} ${AXIS + 5}`} fill="none" stroke="var(--muted)" />
              <path d={`${path} L${pts[pts.length - 1][0]} ${AXIS} L${pts[0][0]} ${AXIS} Z`} fill="var(--accent)" opacity="0.08" />
              <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
              {pts.map((p, i) => {
                const ev = !!t.events[years[i]];
                return (
                  <g key={years[i]}>
                    {ev && <circle cx={p[0]} cy={p[1]} r={i === sel ? 9 : 7} fill="none" stroke="var(--violet)" strokeWidth="1.5" opacity="0.6" />}
                    <circle cx={p[0]} cy={p[1]} r={i === sel ? 5 : ev ? 4.5 : 3} fill={i === sel ? 'var(--fg)' : ev ? 'var(--violet)' : 'var(--accent)'} />
                  </g>
                );
              })}
              {sel >= 0 && (
                <g>
                  <line x1={pts[sel][0]} x2={pts[sel][0]} y1={pts[sel][1] + 6} y2={AXIS} stroke="var(--fg)" strokeDasharray="2 3" />
                  <text x={pts[sel][0]} y={pts[sel][1] - 10} textAnchor="middle" fontFamily={MONO} fontSize="12" fontWeight="500" fill="var(--fg)">{global[year][0]}%</text>
                </g>
              )}
              {years.map((yr, i) => (narrow && i % 2 ? null : (
                <text key={yr} x={x(i)} y={AXIS + 18} textAnchor="middle" fontFamily={MONO} fontSize={fs} fontWeight={i === sel ? 700 : 400} fill={i === sel ? 'var(--fg)' : 'var(--muted)'}>
                  {narrow ? `'${String(yr).slice(2)}` : yr}
                </text>
              )))}
              <text x={(afterX0 + W) / 2} y={AXIS + 18} textAnchor="middle" fontFamily={MONO} fontSize={fs} fill="var(--muted)">2023–25</text>
            </svg>
          )}
          {W > 0 && years.map((yr, i) => (
            <button key={yr} type="button" className="yr" aria-pressed={i === sel}
              aria-label={`${t.tlYear(yr, global[yr][0])}. ${t.events[yr] || ''}`}
              style={{ left: x(i) - step / 2, width: step }}
              onClick={() => onPickYear(year === yr ? null : yr)}
              onMouseEnter={() => setHover(yr)} onFocus={() => setHover(yr)}
              onMouseLeave={() => setHover(null)} onBlur={() => setHover(null)} />
          ))}
          {open && ti >= 0 && W > 0 && (
            <div className="tip" role="status" style={{ left: Math.max(140, Math.min(W - 140, pts[ti][0])), top: pts[ti][1] }}>
              <b>{t.tlYear(tipYear, global[tipYear][0])}</b>{t.events[tipYear] || t.tlNoEvent}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
