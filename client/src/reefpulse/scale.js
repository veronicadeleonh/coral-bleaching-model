// Colour scales shared by the 2D map and the globe.

// Relative risk ramp: under one heatwave the reefs span a narrow band (e.g. 8–33%), so dots are
// coloured by their place in that band. The legend on the globe shows the real ends.
export const RISK_STOPS = ['#BFE6FA', '#7FD3E8', '#FFE08A', '#FF9A4A', '#E8452A'];

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

export function rampHex(t) {
  t = Math.max(0, Math.min(1, t)) * (RISK_STOPS.length - 1);
  const i = Math.min(RISK_STOPS.length - 2, Math.floor(t));
  const a = hex(RISK_STOPS[i]), b = hex(RISK_STOPS[i + 1]), k = t - i;
  return toHex(a.map((v, j) => v + (b[j] - v) * k));
}

// Observed bleaching (0–60%+): coral red → bone white, for the year view on the map.
export function bleachCss(p) {
  const t = Math.max(0, Math.min(1, p / 60)), a = [255, 79, 94], b = [237, 230, 218];
  return toHex(a.map((v, i) => v + (b[i] - v) * t));
}
