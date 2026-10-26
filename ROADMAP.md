# Roadmap

## Fase 1 — Modelo y app con Reef Check (en curso)
- [x] Paso 1 · Auditoría de la variable objetivo → solo Reef Check (`dev-notebooks/01_target_audit.ipynb`)
- [x] Paso 2 · Dataset limpio, una fila por muestreo (`dev-notebooks/02_build_reefcheck_dataset.ipynb` → `data/coral_reefcheck.csv`)
- [x] Paso 3 · Partición temporal y modelo base con `tsa_dhw` (`dev-notebooks/03_baseline_model.ipynb`)
- [x] Paso 4 · Modelo final: logística con `log_dhw` + `ssta_sd` + `lat_dev` → `models/risk_model_v1.json` (`dev-notebooks/04_final_risk_model.ipynb`)
- [x] Paso 5 · Modelo conectado al prototipo V4 (riesgo calculado en el navegador)
- [x] Paso 6 · V4 en React: `client/src/reefpulse/` (datos: `python scripts/build_app_data.py`)
- [ ] Paso 7 · Revisión de accesibilidad (WCAG) paso a paso
- [ ] Paso 8 · Deploy en Vercel solo con el cliente (Flask ya no es necesario para predecir)
- [ ] App: mostrar el riesgo regional ("X de cada 100 muestreos"), profundidad y exposición como contexto explicativo

## Fase 2 — Datos más ricos (ideas)
- **MERMAID** (WCS) — https://datamermaid.org/
  - Protocolo de blanqueamiento en MERMAID Collect (por colonia).
  - Explorar datos en MERMAID Explore: https://explore.datamermaid.org (permite exportar).
  - Acceso programático: API y paquete de R `mermaidr`.
  - ⚠️ Cada propietario decide si sus datos son abiertos o restringidos; revisar los términos de uso antes de usarlos.
- Censos aéreos de blanqueamiento de la Gran Barrera (arrecifes enteros, 1998–2024).
- Allen Coral Atlas: blanqueamiento desde satélite (4–10 m, cada dos semanas desde 2021).
- NOAA Coral Reef Watch: DHW diario por región (capa "Hoy").
