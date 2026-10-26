// Risk model v1 (see dev-notebooks/04_final_risk_model.ipynb).
// Logistic regression: P(more than 10% of corals bleached in a Reef Check survey).
//   z = intercept + Σ coef_i · (x_i − mean_i) / scale_i
//   x = [ln(1 + DHW), ssta_sd, (|lat| − 17.5)²]

export function riskOf(model, dhw, sstaSd, lat) {
  const x = [Math.log1p(dhw), sstaSd, (Math.abs(lat) - 17.5) ** 2];
  let z = model.intercept;
  for (let i = 0; i < x.length; i++) {
    z += (model.coef[i] * (x[i] - model.mean[i])) / model.scale[i];
  }
  return 1 / (1 + Math.exp(-z));
}

// NOAA only counts heat as stress from +1 °C above the summer peak (a "HotSpot" ≥ 1).
export function dhwFrom(intensity, weeks) {
  return intensity >= 1 ? intensity * weeks : 0;
}

export const LEVELS = [10, 20, 35]; // % thresholds between Low / Moderate / High / Very high

export function levelIndex(pct) {
  const i = LEVELS.findIndex((t) => pct < t);
  return i === -1 ? LEVELS.length : i;
}

// Reef properties used by the model, in plain categories for the UI.
export function variabilityIndex(sstaSd) {
  if (sstaSd < 0.78) return 0; // stable
  if (sstaSd > 0.95) return 2; // variable
  return 1;
}

export function latitudeIndex(lat) {
  const d = Math.abs(Math.abs(lat) - 17.5);
  if (d <= 2.5) return 0; // inside the 15–20° belt
  if (d <= 7.5) return 1; // close
  return 2; // far
}
