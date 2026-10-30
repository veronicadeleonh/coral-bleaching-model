import { useEffect, useRef, useState } from 'react';
import { createEngine } from '../scene/engine';

// Hosts the three.js scene. The engine is created once; React pushes changes to it through
// engineRef, and the engine reports back (reef picked on the globe, globe opened/closed) through callbacks.
export default function ReefScene({ engineRef, reefs, riskOf, getState, text, onPick, onGlobe, onCloseUp, onReturn, label, fallback }) {
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const cb = useRef({});
  cb.current = { getState, text, onPick, onGlobe, onCloseUp, onReturn };

  useEffect(() => {
    let engine;
    try {
      engine = createEngine({
        canvas: canvasRef.current,
        stage: stageRef.current,
        reefs,
        riskOf,
        assets: `${process.env.PUBLIC_URL}/reefpulse`,
        getState: () => cb.current.getState(),
        text: () => cb.current.text(),
        onPick: (i) => cb.current.onPick(i),
        onGlobe: (on) => cb.current.onGlobe(on),
        onCloseUp: (on) => cb.current.onCloseUp(on),
        onReturn: () => cb.current.onReturn(),
      });
    } catch (e) {
      setFailed(true);
      return undefined;
    }
    engineRef.current = engine;
    if (engine.debug) window.__rp = engine.debug;
    // Preview builds only (REACT_APP_RP_TUNE=1): let the parent page adjust the render through postMessage
    let onTune = null;
    if (engine.debug && process.env.REACT_APP_RP_TUNE) {
      const resolve = (path) => { const keys = path.split('.'); const last = keys.pop(); let o = engine.debug; keys.forEach((k) => { o = o[k]; }); return [o, last]; };
      onTune = (e) => {
        const m = e.data && e.data.rpTune; if (!m) return;
        let out;
        try {
          if (m.set) m.set.forEach(([path, v]) => { const [o, k] = resolve(path); if (o[k] && o[k].isColor) o[k].set(v); else o[k] = v; });
          if (m.call) { const [o, k] = resolve(m.call); out = o[k](...(m.args || [])); }
          if (m.get) out = m.get.map((path) => { const [o, k] = resolve(path); const v = o[k]; return v && v.isColor ? '#' + v.getHexString() : v; });
        } catch (err) { out = 'error: ' + err.message; }
        e.source && e.source.postMessage({ rpReply: out === undefined ? 'ok' : out }, '*');
      };
      window.addEventListener('message', onTune);
    }
    return () => { if (onTune) window.removeEventListener('message', onTune); engine.dispose(); engineRef.current = null; };
    // The engine lives for the whole page; reefs and model never change.
  }, []);

  return (
    <div className="stage" ref={stageRef}>
      <canvas ref={canvasRef} role="img" aria-label={label} />
      {failed && <div className="fallback">{fallback}</div>}
    </div>
  );
}
