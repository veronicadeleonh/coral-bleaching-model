// In development, calls go to localhost:5001 via the CRA proxy.
// In production, they go to the Render API URL set in REACT_APP_API_URL.
const BASE = process.env.REACT_APP_API_URL || '';

export const API = {
  reefs:      `${BASE}/api/reefs`,
  timeseries: `${BASE}/api/timeseries`,
  presets:    `${BASE}/api/presets`,
  predict:    `${BASE}/api/predict`,
  shap:       `${BASE}/api/shap`,
  health:     `${BASE}/api/health`,
};
