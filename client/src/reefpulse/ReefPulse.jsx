import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import './reefpulse.css';
import data from './data/reefPulse.json';
import { STRINGS } from './i18n';
import { dhwFrom, latitudeIndex, levelIndex, riskOf, variabilityIndex } from './risk';
import { bleachCss, rampHex } from './scale';
import ReefScene from './components/ReefScene';
import { ObservedSentence, Ruler, SimSentence } from './components/Sentence';
import MapFigure from './components/MapFigure';
import Timeline from './components/Timeline';
import HowWeKnow from './components/HowWeKnow';

const REEFS = data.reefs;
const YEARS = Object.keys(data.global_years).map(Number).sort((a, b) => a - b);
const DEFAULT_REEF = Math.max(0, REEFS.findIndex((r) => r.name.startsWith('Central and northern Great Barrier')));
const model = data.model;
const risk = (dhw, sd, lat) => riskOf(model, dhw, sd, lat);
const shortName = (n) => n.replace(/^Central and northern /, 'central ');
// The four longest reef names decide how tall the sentence box must be
const LONGEST = REEFS.map((r) => shortName(r.name)).sort((a, b) => b.length - a.length).slice(0, 4);

function presetsFor(r) {
  const hot = r.dhw_p90 > 0 ? [1.25, Math.max(1, Math.min(12, Math.round(r.dhw_p90 / 1.25)))] : [0.5, 4];
  return [hot, [2, 4], [3, 5]];
}
const clampHeat = (v) => Math.max(0, Math.min(4, Math.round(v * 4) / 4));
const clampWeeks = (v) => Math.max(0, Math.min(12, Math.round(v)));

export default function ReefPulse() {
  const [lang, setLang] = useState('en');
  const [reef, setReef] = useState(DEFAULT_REEF);
  const [heat, setHeat] = useState(2);
  const [weeks, setWeeks] = useState(4);
  const [active, setActive] = useState(null);      // which value has its ruler open
  const [year, setYear] = useState(null);          // a year from the timeline, or null for the simulation
  const [mapOpen, setMapOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [globe, setGlobe] = useState(false);
  const [closeUp, setCloseUp] = useState(false);
  const [water, setWater] = useState(true);
  const engine = useRef(null);
  const reefTokRef = useRef(null);

  const t = STRINGS[lang];
  const r = REEFS[reef];
  const dhw = dhwFrom(heat, weeks);
  const simPct = Math.round(risk(dhw, r.ssta_sd, r.lat) * 100);
  const obs = year ? r.years[String(year)] : null;
  const shownPct = year ? (obs ? Math.round(obs[0]) : null) : simPct;
  const reefName = shortName(r.name);

  // ── State the 3D scene reads ──
  const live = useRef({});
  live.current = { reef, heat, weeks, t };
  const getState = useCallback(() => live.current, []);
  const text = useCallback(() => live.current.t, []);

  useEffect(() => { engine.current?.setLevel(shownPct == null ? 0 : shownPct / 60); engine.current?.setDim(shownPct == null); }, [shownPct]);
  useEffect(() => { engine.current?.refreshPins(); }, [heat, weeks, lang]);
  useEffect(() => { engine.current?.setWater(water); }, [water]);
  useEffect(() => { document.body.dataset.drawer = String(drawerOpen); document.body.dataset.globe = String(globe); }, [drawerOpen, globe]);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  // ── Actions ──
  const changeHeat = (v) => { setHeat(clampHeat(v)); setYear(null); };
  const changeWeeks = (v) => { setWeeks(clampWeeks(v)); setYear(null); };
  const pickReef = (i) => { setReef(i); setMapOpen(false); };
  const preset = (i) => { const [h, w] = presetsFor(r)[i]; setHeat(h); setWeeks(w); setYear(null); };
  const openGlobe = () => { setMapOpen(false); setActive(null); engine.current?.enterGlobe(); };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (engine.current?.inGlobe()) engine.current.leaveGlobe(null);
      else if (active) setActive(null);
      else if (mapOpen) setMapOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, mapOpen]);

  // ── Map colours: relative risk under this heatwave, or what was recorded in the chosen year ──
  const { fills, hollow } = useMemo(() => {
    if (year) {
      return {
        fills: REEFS.map((rr) => { const v = rr.years[String(year)]; return v ? bleachCss(v[0] * 1.2) : 'transparent'; }),
        hollow: REEFS.map((rr) => !rr.years[String(year)]),
      };
    }
    const v = REEFS.map((rr) => risk(dhw, rr.ssta_sd, rr.lat) * 100);
    const lo = Math.min(...v), hi = Math.max(...v);
    return { fills: v.map((x) => rampHex((x - lo) / Math.max(1, hi - lo))), hollow: REEFS.map(() => false) };
  }, [year, dhw]);

  // ── Keep the sentence box at the height of its longest version, so nothing below it jumps ──
  const storyRef = useRef(null);
  const probeRef = useRef(null);
  const [sentH, setSentH] = useState(0);
  useLayoutEffect(() => {
    const measure = () => {
      const p = probeRef.current; if (!p) return;
      setSentH(Math.max(...[...p.children].map((c) => c.offsetHeight)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(storyRef.current);
    document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, [lang, mapOpen, drawerOpen]);

  const li = latitudeIndex(r.lat), vi = variabilityIndex(r.ssta_sd);
  const ns = r.lat >= 0 ? 'N' : 'S', ew = r.lon >= 0 ? 'E' : 'W';
  const caption = mapOpen ? t.mapPick
    : `${Math.abs(r.lat).toFixed(2)}°${ns} ${Math.abs(r.lon).toFixed(2)}°${ew} · ${r.ocean} · ${t.surveys(r.n)}`;

  return (
    <div className="rp">
      <ReefScene
        engineRef={engine} reefs={REEFS} riskOf={risk} getState={getState} text={text}
        onPick={(i) => { setReef(i); setYear(null); }}
        onGlobe={setGlobe}
        onCloseUp={setCloseUp}
        onReturn={() => reefTokRef.current?.querySelector('.tok--reef')?.focus({ preventScroll: true })}
        label={t.coralAria} fallback={t.noWebgl}
      />

      <div className="page">
        <header>
          <span className="brand">{t.brand}</span>
          <nav>
            <div className="seg" role="group" aria-label={t.language}>
              {['en', 'es'].map((l) => (
                <button key={l} type="button" className="pill" aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
              ))}
            </div>
            <HowWeKnow t={t} />
          </nav>
        </header>

        <main className="story" ref={storyRef} data-map={mapOpen ? 'open' : 'closed'} data-ruler={String(!!active)} aria-live="polite">
          <span className="eyebrow">{t.eyebrow}</span>

          <div className="sentwrap" ref={reefTokRef} style={{ minHeight: sentH || undefined }}>
            {year
              ? <ObservedSentence t={t} year={year} reefName={reefName} obs={obs ? [Math.round(obs[0]), obs[1]] : null} />
              : <SimSentence t={t} reefName={reefName} heat={heat} weeks={weeks} pct={simPct} active={active} mapOpen={mapOpen}
                  onHeat={changeHeat} onWeeks={changeWeeks} onToggle={(k) => setActive((a) => (a === k ? null : k))}
                  onReef={() => setMapOpen((o) => !o)} />}
            {active && !year && <Ruler t={t} k={active} value={active === 'heat' ? heat : weeks} onChange={active === 'heat' ? changeHeat : changeWeeks} />}
            {/* Invisible copies of the longest versions, measured to size the box */}
            <div className="sentprobe" ref={probeRef} aria-hidden="true">
              {LONGEST.map((n) => (
                <div key={n}>
                  <SimSentence probe t={t} reefName={n} heat={3.25} weeks={12} pct={100} />
                </div>
              ))}
              {LONGEST.slice(0, 2).map((n) => <div key={`o${n}`}><ObservedSentence t={t} year={2019} reefName={n} obs={null} /></div>)}
            </div>
          </div>

          <div className="hintbox">
            {year ? (
              <p className="hintline"><button type="button" className="linkbtn" onClick={() => setYear(null)}>{t.back}</button></p>
            ) : (
              <p className="hintline" id="rp-drag-hint">
                {t.hintStart}
                {t.presets.map((p, i) => (
                  <span key={p}><button type="button" className="linkbtn" onClick={() => preset(i)}>{p}</button>{t.hintJoin[i]}</span>
                ))}
                {t.hintEnd}
              </p>
            )}
          </div>
          {shownPct != null && <span className="level">{year ? t.observedLevel : t.riskLevel} · <b>{t.levels[levelIndex(shownPct)]}</b></span>}

          <div className="where">
            <MapFigure t={t} reefs={REEFS} selected={reef} fills={fills} hollow={hollow} open={mapOpen} caption={caption}
              onPick={pickReef} onToggle={() => setMapOpen((o) => !o)} onGlobe={openGlobe} />
            <div className="factors">
              <span><b>{['↑', '↗', '↓'][li]} {t.latTitle(Math.round(Math.abs(r.lat)))}</b><br /><span>{t.latNotes[li]}</span></span>
              <span><b>{['↑', '→', '↓'][vi]} {t.varTitles[vi]}</b><br /><span>{t.varNotes[vi]}</span></span>
            </div>
          </div>
        </main>
        <div />
      </div>

      {globe ? (
        <button type="button" className="pill globeback" onClick={() => engine.current?.leaveGlobe(null)}>{t.globeBack}</button>
      ) : (
        <div className="scene-ctl">
          <button type="button" className="pill" onClick={() => engine.current?.newColony()}>{t.newColony}</button>
          <button type="button" className="pill" aria-pressed={closeUp} onClick={() => { const on = !closeUp; setCloseUp(on); engine.current?.setCloseUp(on); }}>{t.closeUp}</button>
          <button type="button" className="pill" aria-pressed={water} onClick={() => setWater((w) => !w)}>{t.water}</button>
        </div>
      )}

      <Timeline t={t} years={YEARS} global={data.global_years} year={year} open={drawerOpen}
        onToggle={() => setDrawerOpen((o) => !o)} onPickYear={(y) => { setYear(y); setActive(null); }} />
    </div>
  );
}
