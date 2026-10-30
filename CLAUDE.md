# CLAUDE.md

**Reef Pulse**: an interactive 3D coral colony (three.js) that shows how heat stress, latitude and water variability change the risk of coral bleaching, with real Reef Check surveys behind it. Personal data project by Verónica De León Hernández (https://veronicadeleonh.de/). Repo: veronicadeleonh/coral-bleaching-model.

Started in 2025 as the final project of her Data Analytics bootcamp (Ironhack Berlin), paused for lack of marine-science domain knowledge, revisited with Claude in Apr–Jun 2026 (React app around a world map, XGBoost model), and rebuilt from Oct 2026 as Reef Pulse. Verónica owns the design and the UX; she wants Claude's help with the science side: data handling and feature choices. Explain modelling decisions in plain language.

## Commands

```bash
# front end (the app)
cd client && npm install
npm start          # http://localhost:3000
npm run build

# data → app (run from the project root after changing models/ or data/)
python scripts/build_app_data.py   # writes client/src/reefpulse/data/reefPulse.json
```

## How it works now

- The front end is static: it imports `client/src/reefpulse/data/reefPulse.json` and computes risk in the browser (`risk.js`). No API call.
- Model: a logistic risk model (`models/risk_model_v1.json`: coefficients, scaler, DHW percentiles) trained **only on Reef Check surveys**; the Donner source is excluded on purpose. Built in `dev-notebooks/02`–`04`.
- Data: `data/coral_reefcheck.csv` (one row per survey), `data/reefs_reefcheck.json` (one row per ecoregion). "Noticeable bleaching" = more than 10% of corals bleached; reef-year bars need at least 5 surveys.
- Scene: `client/src/reefpulse/scene/engine.js` (plain three.js driven from React through a small API: `setLevel`, `newColony`, `enterGlobe`…) and `components/ReefScene.jsx`. Main colony is procedural (space colonisation); bleaching is a shader driven by the risk level. Background corals bleach later than the specimen (`uLag`) so the reef reads alive at moderate risk.
- Render: post-processing (n8ao AO, depth of field, bloom, ACES, grade, vignette), procedural water backdrop + light shafts, depth fog that absorbs red. Quality tiers `high` / `low` (phones) / `off`, auto step-down on slow frames; pixel ratio 1 with effects (Retina at 2x halved the frame rate). URL flags: `?quality=high|low|off`, `?debug` (exposes `window.__rp`).
- 3D assets (`client/public/reefpulse/models/`, ~8 MB, loaded after the first frame, all CC0): Smithsonian coral scans (shaded as live tissue by the coral shader), ffish.asia / floraZia fish, clam and urchin (fish swim via a vertex-shader body wave), Poly Haven rocks (relief only, coloured by the live-rock shader). Credits are in "How we know". Raw downloads are not kept in the repo; scans were cut from museum bases, decimated and compressed with gltf-transform/meshoptimizer (Blender `bpy` for the Poly Haven .blend files).
- Copy and UI strings are bilingual in `i18n.js`. Keep both languages in sync.

## Legacy (from the 2026 React + Flask version)

`api/` (Flask), `render.yaml`, the XGBoost/SHAP files in `models/*.joblib` and `data/coral_clean.csv` belong to the previous app, which Reef Pulse replaced. The README still describes that version. Ask before deleting anything; update the README when the revamp ships.

## Design

- One committed dark look, "the page is the sea": palette from an underwater photo (deep blues, `--sun` cyan, one orange accent `--accent`), no light theme. Tokens live at the top of `reefpulse.css`.
- Type: Schibsted Grotesk (display), IBM Plex Mono.
- The coral is the centre of the experience; the sentence, map and timeline sit on the scene without panels.
- Elegant, neither corporate nor childish. Fewer pills, small radii.

## Before deploying (next steps)

1. ~~Render quality pass~~ and scanned reef life: done (Oct 2026). Open: remove the two flat procedural sponge blobs?
2. `visual-consistency-qa`, then `build-tokens-page` (`/#tokens`) to see what is tokenized.
3. `wcag-audit-learning`: Verónica runs Lighthouse, axe and WAVE; explain each fix before applying it. The 3D canvas needs a non-visual alternative (the sentence and map must carry the same information) and `prefers-reduced-motion`.
4. Deploy on Vercel (front end only).

## Working style

- Small, single-change steps. Verónica reviews, commits and pushes herself.
- Keep this file current and short: when a decision changes, replace the old line instead of adding a new one.
