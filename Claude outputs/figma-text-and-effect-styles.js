// Reef Pulse · text styles, effect styles and the coral bleaching ramp for Figma
// How to run: in the "Reef Pulse — Tokens & Type" file, open the community plugin
// "Scripter", paste this whole file and press Run. Safe to run twice: existing
// styles with the same name are skipped.

const M = 'Manrope', J = 'JetBrains Mono';
for (const [family, style] of [[M, 'Light'], [M, 'Regular'], [M, 'Medium'], [M, 'Bold'], [J, 'Regular'], [J, 'Medium']]) {
  await figma.loadFontAsync({ family, style });
}

const pct = (v) => ({ unit: 'PERCENT', value: v });
// name, family, style, size, line height, letter spacing, case, description (CSS class in the app)
const TEXT = [
  ['display/result', M, 'Bold', 56, pct(100), pct(-3), 'ORIGINAL', 'Result percentage (.rp-big)'],
  ['heading/reef', M, 'Medium', 20, pct(130), pct(0), 'ORIGINAL', 'Reef selector (.rp-reef-select)'],
  ['heading/brand', M, 'Bold', 17, pct(130), pct(-1), 'ORIGINAL', 'Brand name in the header'],
  ['body/hero', M, 'Light', 18, pct(145), pct(-1), 'ORIGINAL', 'Intro paragraph (.rp-hero)'],
  ['body/base', M, 'Regular', 14, pct(155), pct(0), 'ORIGINAL', 'Body copy (.rp-body)'],
  ['body/strong', M, 'Medium', 14, pct(140), pct(0), 'ORIGINAL', 'Short emphasised lines (.rp-strong)'],
  ['label/eyebrow', M, 'Bold', 12, pct(130), pct(10), 'UPPER', 'Section and control labels (.rp-eyebrow)'],
  ['label/pill', M, 'Medium', 12, pct(130), pct(0), 'ORIGINAL', 'Pills and buttons (.rp-pill)'],
  ['caption/note', M, 'Regular', 12, pct(150), pct(0), 'ORIGINAL', 'Notes and hints (.rp-note)'],
  ['data/value', J, 'Medium', 16, pct(130), pct(0), 'ORIGINAL', 'Control readouts (.rp-value)'],
  ['data/coords', J, 'Regular', 12, pct(140), pct(2), 'ORIGINAL', 'Coordinates and survey count (.rp-coords)'],
  ['data/level', J, 'Medium', 11, pct(130), pct(8), 'UPPER', 'Risk level capsule (.rp-level)'],
  ['data/axis', J, 'Regular', 11, pct(130), pct(0), 'ORIGINAL', 'Timeline year labels (.rp-tl-label)'],
];

const existingText = new Set((await figma.getLocalTextStylesAsync()).map((s) => s.name));
let created = 0;
for (const [name, family, style, size, lh, ls, tc, desc] of TEXT) {
  if (existingText.has(name)) continue;
  const s = figma.createTextStyle();
  s.name = name; s.fontName = { family, style }; s.fontSize = size;
  s.lineHeight = lh; s.letterSpacing = ls; s.textCase = tc; s.description = desc;
  created++;
}

const EFFECTS = [
  ['glass/panel', 'Glass panel: blur + soft drop shadow + top highlight (.rp-panel)', [
    { type: 'BACKGROUND_BLUR', radius: 14, visible: true },
    { type: 'DROP_SHADOW', color: { r: 3 / 255, g: 10 / 255, b: 30 / 255, a: 0.35 }, offset: { x: 0, y: 20 }, radius: 50, spread: 0, visible: true, blendMode: 'NORMAL' },
    { type: 'INNER_SHADOW', color: { r: 1, g: 1, b: 1, a: 0.05 }, offset: { x: 0, y: 1 }, radius: 0, spread: 0, visible: true, blendMode: 'NORMAL' },
  ]],
  ['glow/accent', 'Selected pill, slider thumb, active timeline year', [
    { type: 'DROP_SHADOW', color: { r: 0, g: 209 / 255, b: 193 / 255, a: 0.35 }, offset: { x: 0, y: 0 }, radius: 14, spread: 0, visible: true, blendMode: 'NORMAL' },
  ]],
  ['glow/coral', 'Soft glow around the coral specimen', [
    { type: 'DROP_SHADOW', color: { r: 1, g: 79 / 255, b: 94 / 255, a: 0.18 }, offset: { x: 0, y: 0 }, radius: 22, spread: 0, visible: true, blendMode: 'NORMAL' },
  ]],
];
const existingFx = new Set((await figma.getLocalEffectStylesAsync()).map((s) => s.name));
for (const [name, desc, effects] of EFFECTS) {
  if (existingFx.has(name)) continue;
  const e = figma.createEffectStyle();
  e.name = name; e.description = desc; e.effects = effects;
  created++;
}

// ── Coral bleaching ramp ─────────────────────────────────────────────
// The coral and every data colour blend from a living colour towards bone white
// (coral.js → mix()). 0 = healthy, 100 = fully bleached.
const RAMP = [
  ['coral/bleach-0', '#ff4f5e'],
  ['coral/bleach-25', '#fa757d'],
  ['coral/bleach-50', '#f69a9c'],
  ['coral/bleach-75', '#f2c0bb'],
  ['coral/bleach-100', '#ede6da'],
  ['violet/bleach-0', '#9b5de5'],
  ['violet/bleach-25', '#b07fe2'],
  ['violet/bleach-50', '#c4a2e0'],
  ['violet/bleach-75', '#d8c4dd'],
  ['violet/bleach-100', '#ede6da'],
];
const hexToRgb = (h) => { const n = parseInt(h.slice(1), 16); return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255, a: 1 }; };
const cols = await figma.variables.getLocalVariableCollectionsAsync();
const prim = cols.find((c) => c.name === 'Primitives');
const color = cols.find((c) => c.name === 'Color');
let rampCreated = 0;
if (prim && color) {
  const all = await figma.variables.getLocalVariablesAsync('COLOR');
  const byName = (coll, name) => all.find((v) => v.variableCollectionId === coll.id && v.name === name);
  for (const [name, hex] of RAMP) {
    let v = byName(prim, name);
    if (!v) {
      v = figma.variables.createVariable(name, prim, 'COLOR');
      v.setValueForMode(prim.modes[0].modeId, hexToRgb(hex));
      v.scopes = [];
      rampCreated++;
    }
    // Semantic alias for the data scale (map dots, timeline bars, coral branches)
    const semName = `data/bleach/${name.replace('/bleach-', '-')}`;
    if (!byName(color, semName)) {
      const sv = figma.variables.createVariable(semName, color, 'COLOR');
      sv.setValueForMode(color.modes[0].modeId, { type: 'VARIABLE_ALIAS', id: v.id });
      sv.scopes = ['FRAME_FILL', 'SHAPE_FILL', 'STROKE_COLOR'];
      sv.description = `${name.split('/')[0]} blended ${name.split('-')[1]}% towards bone (coral.js mix())`;
      rampCreated++;
    }
  }
}

const msg = `Reef Pulse: ${created} styles + ${rampCreated} coral ramp variables created`;
if (typeof print === 'function') print(msg); else console.log(msg);
