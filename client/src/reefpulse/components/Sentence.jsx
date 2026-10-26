import { useRef } from 'react';

const STEP = { heat: 0.25, weeks: 1 };
const PX_PER_UNIT = { heat: 60, weeks: 18 };

// A value inside the sentence: drag sideways to change it, click to open the ruler, arrows to step.
function Scrub({ k, value, label, aria, open, onChange, onToggle }) {
  const drag = useRef(null);
  return (
    <span
      role="button" tabIndex={0} className="tok" aria-expanded={open} aria-label={aria} aria-describedby="rp-drag-hint"
      onPointerDown={(e) => { drag.current = { x: e.clientX, v: value, moved: false }; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => {
        const d = drag.current; if (!d) return;
        const dx = e.clientX - d.x;
        if (Math.abs(dx) > 3) d.moved = true;
        if (d.moved) onChange(d.v + dx / PX_PER_UNIT[k]);
      }}
      onPointerUp={() => { const d = drag.current; drag.current = null; if (d && !d.moved) onToggle(); }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onChange(value + STEP[k]); }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onChange(value - STEP[k]); }
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); }
      }}
    >{label}</span>
  );
}

export const heatLabel = (h) => '+' + (Number.isInteger(h) ? h.toFixed(1) : String(h)) + ' °C';

// The simulation sentence. Its pieces come from i18n so word order follows the language.
export function SimSentence({ t, reefName, heat, weeks, pct, active, mapOpen, onHeat, onWeeks, onToggle, onReef, probe }) {
  const parts = {
    reef: probe
      ? <span className="tok tok--reef">{reefName} ▾</span>
      : (
        <span role="button" tabIndex={0} className="tok tok--reef" aria-expanded={mapOpen} aria-label={t.reefAria(reefName)}
          onClick={onReef} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onReef(); } }}>
          {reefName} ▾
        </span>
      ),
    heat: probe ? <span className="tok">{heatLabel(heat)}</span>
      : <Scrub k="heat" value={heat} label={heatLabel(heat)} aria={t.heatAria(heatLabel(heat))} open={active === 'heat'} onChange={onHeat} onToggle={() => onToggle('heat')} />,
    weeks: probe ? <span className="tok">{t.weeks(weeks)}</span>
      : <Scrub k="weeks" value={weeks} label={t.weeks(weeks)} aria={t.weeksAria(t.weeks(weeks))} open={active === 'weeks'} onChange={onWeeks} onToggle={() => onToggle('weeks')} />,
    pct: <strong>{t.pct(pct)}</strong>,
  };
  return <p className="sentence">{t.sentence.map((p, i) => (parts[p] ? <span key={i}>{parts[p]}</span> : p))}</p>;
}

export function ObservedSentence({ t, year, reefName, obs }) {
  if (!obs) return <p className="sentence">{t.noSurveys(year, reefName)}</p>;
  return (
    <p className="sentence">
      {t.observed(year, reefName, obs[0], obs[1]).map((p, i) => (
        typeof p === 'string' ? <span key={i}>{p}</span>
          : p.strong ? <strong key={i}>{p.strong}</strong>
            : <span key={i} className="sentence__small">{p.small}</span>
      ))}
    </p>
  );
}

// Ruler for the open value, with − and + buttons
export function Ruler({ t, k, value, onChange }) {
  const isHeat = k === 'heat';
  const ticks = isHeat ? [0, 1, 2, 3, 4] : [0, 3, 6, 9, 12];
  const max = isHeat ? 4 : 12;
  return (
    <div className="ruler">
      <button type="button" className="round" aria-label={t.less} onClick={() => onChange(value - STEP[k])}>−</button>
      <div className="ruler__scale" aria-hidden="true">
        <div className="ruler__line" />
        {ticks.map((v) => (
          <span key={v}>
            <span className="ruler__tick" style={{ left: `${(v / max) * 100}%` }} />
            <span className="ruler__lab" style={{ left: `${(v / max) * 100}%` }}>{isHeat ? `+${v} °C` : `${v} ${t.wk}`}</span>
          </span>
        ))}
        <span className="ruler__mark" style={{ left: `${(value / max) * 100}%` }} />
      </div>
      <button type="button" className="round" aria-label={t.more} onClick={() => onChange(value + STEP[k])}>+</button>
    </div>
  );
}
