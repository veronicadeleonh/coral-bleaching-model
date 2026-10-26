// Reef Pulse — export variables + styles as JSON (run in the Scripter plugin).
// Output: printed in Scripter's console AND placed as a text layer on a page "tokens-export".
// Copy the JSON into corals/design/figma-export/tokens.json

const hex = ({ r, g, b, a = 1 }) =>
  '#' + [r, g, b].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('') +
  (a < 1 ? Math.round(a * 255).toString(16).padStart(2, '0') : '');

const allVars = await figma.variables.getLocalVariablesAsync();
const byId = Object.fromEntries(allVars.map((v) => [v.id, v]));
const val = (v) => {
  if (v && typeof v === 'object' && v.type === 'VARIABLE_ALIAS') return { alias: byId[v.id]?.name ?? v.id };
  if (v && typeof v === 'object' && 'r' in v) return hex(v);
  return v;
};

const out = { variables: {}, textStyles: {}, paintStyles: {}, effectStyles: {} };

for (const col of await figma.variables.getLocalVariableCollectionsAsync()) {
  const modes = Object.fromEntries(col.modes.map((m) => [m.modeId, m.name]));
  out.variables[col.name] = {};
  for (const id of col.variableIds) {
    const v = byId[id]; if (!v) continue;
    const values = {};
    for (const [modeId, raw] of Object.entries(v.valuesByMode)) values[modes[modeId]] = val(raw);
    out.variables[col.name][v.name] = {
      type: v.resolvedType, values,
      ...(v.codeSyntax?.WEB ? { css: v.codeSyntax.WEB } : {}),
      ...(v.description ? { description: v.description } : {}),
    };
  }
}

for (const s of await figma.getLocalTextStylesAsync()) {
  out.textStyles[s.name] = {
    family: s.fontName.family, style: s.fontName.style, size: s.fontSize,
    lineHeight: s.lineHeight.unit === 'AUTO' ? 'auto' : `${s.lineHeight.value}${s.lineHeight.unit === 'PERCENT' ? '%' : 'px'}`,
    letterSpacing: `${s.letterSpacing.value}${s.letterSpacing.unit === 'PERCENT' ? '%' : 'px'}`,
    textCase: s.textCase, decoration: s.textDecoration,
    ...(Object.keys(s.boundVariables || {}).length ? { boundVariables: Object.fromEntries(Object.entries(s.boundVariables).map(([k, a]) => [k, byId[a.id]?.name])) } : {}),
  };
}

for (const s of await figma.getLocalPaintStylesAsync()) {
  out.paintStyles[s.name] = s.paints.map((p) => p.type === 'SOLID' ? hex({ ...p.color, a: p.opacity ?? 1 }) :
    { type: p.type, stops: p.gradientStops?.map((g) => [hex(g.color), +g.position.toFixed(3)]) });
}

for (const s of await figma.getLocalEffectStylesAsync()) {
  out.effectStyles[s.name] = s.effects.map((e) => ({
    type: e.type, ...(e.color ? { color: hex(e.color) } : {}), ...(e.offset ? { x: e.offset.x, y: e.offset.y } : {}),
    radius: e.radius, ...(e.spread != null ? { spread: e.spread } : {}),
  }));
}

const json = JSON.stringify(out, null, 2);
print(json);

let page = figma.root.children.find((p) => p.name === 'tokens-export');
if (!page) { page = figma.createPage(); page.name = 'tokens-export'; }
await page.loadAsync?.();
page.children.forEach((n) => n.remove());
await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
const t = figma.createText();
t.fontName = { family: 'Inter', style: 'Regular' };
t.fontSize = 10;
t.characters = json;
page.appendChild(t);
figma.notify(`Exported ${allVars.length} variables, ${Object.keys(out.textStyles).length} text styles → page "tokens-export"`);
