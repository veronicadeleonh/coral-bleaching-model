// Reef Pulse · text and effect styles for Figma
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

const msg = `Reef Pulse: ${created} styles created`;
if (typeof print === 'function') print(msg); else console.log(msg);
