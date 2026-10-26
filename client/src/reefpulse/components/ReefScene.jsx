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
    return () => { engine.dispose(); engineRef.current = null; };
    // The engine lives for the whole page; reefs and model never change.
  }, []);

  return (
    <div className="stage" ref={stageRef}>
      <canvas ref={canvasRef} role="img" aria-label={label} />
      {failed && <div className="fallback">{fallback}</div>}
    </div>
  );
}
