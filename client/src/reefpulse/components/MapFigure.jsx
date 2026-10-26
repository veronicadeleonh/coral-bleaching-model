import { useRef, useState } from 'react';
import land from '../data/land.json';

// The 2D world map: dots per reef, the 15–20° belts, an enlarge toggle and the globe button.
export default function MapFigure({ t, reefs, selected, fills, hollow, open, caption, onPick, onToggle, onGlobe }) {
  const figRef = useRef(null);
  const [label, setLabel] = useState(null);
  const show = (i, el) => {
    const f = figRef.current.getBoundingClientRect(), d = el.getBoundingClientRect();
    setLabel({ name: reefs[i].name, x: d.left + d.width / 2 - f.left, y: d.top + d.height / 2 - f.top - 4 });
  };
  return (
    <figure className="mapfig" ref={figRef}>
      <div className="map" aria-label={t.mapAria} role="group">
        <svg viewBox="0 0 360 150" aria-hidden="true">
          <path d={land.d} fill="var(--land)" fillOpacity="0.5" />
          <rect x="0" y="55" width="360" height="5" fill="var(--accent)" opacity="0.08" />
          <rect x="0" y="90" width="360" height="5" fill="var(--accent)" opacity="0.08" />
          <line x1="0" y1="57.5" x2="360" y2="57.5" stroke="var(--accent)" strokeWidth="1" opacity="0.55" vectorEffect="non-scaling-stroke" />
          <line x1="0" y1="92.5" x2="360" y2="92.5" stroke="var(--accent)" strokeWidth="1" opacity="0.55" vectorEffect="non-scaling-stroke" />
          <line x1="0" y1="75" x2="360" y2="75" stroke="var(--muted)" strokeDasharray="3 3" opacity="0.5" vectorEffect="non-scaling-stroke" />
        </svg>
        {reefs.map((r, i) => (
          <button key={r.id} type="button" className={`dot${hollow[i] ? ' dot--hollow' : ''}`} aria-label={r.name} aria-pressed={i === selected}
            style={{ left: `${((r.lon + 180) / 360) * 100}%`, top: `${((75 - r.lat) / 150) * 100}%` }}
            onClick={() => { setLabel(null); onPick(i); }}
            onMouseEnter={(e) => show(i, e.currentTarget)} onFocus={(e) => show(i, e.currentTarget)}
            onMouseLeave={() => setLabel(null)} onBlur={() => setLabel(null)}>
            <span style={{ background: fills[i] }} />
          </button>
        ))}
      </div>
      <div className="maptools">
        <figcaption className="mapcap">{caption}</figcaption>
        <button type="button" className="mapbtn" aria-expanded={open} title={open ? t.closeMap : t.enlarge} onClick={onToggle}>
          {open
            ? <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
            : <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M8.5 1.5h4v4M5.5 12.5h-4v-4M12.5 1.5L8 6M1.5 12.5L6 8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>}
          <span className="sr">{open ? t.closeMap : t.enlarge}</span>
        </button>
        <button type="button" className="mapbtn" title={t.globe} onClick={onGlobe}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="8" cy="8" r="6.3" /><ellipse cx="8" cy="8" rx="2.8" ry="6.3" /><path d="M1.9 6h12.2M1.9 10h12.2" /></g></svg>
          <span className="sr">{t.globe}</span>
        </button>
      </div>
      {label && <span className="dotlabel" style={{ left: label.x, top: label.y }}>{label.name}</span>}
    </figure>
  );
}
