// Reef Pulse 3D scene: the coral specimen on its reef, fish, water light, and the globe used to pick a reef.
// Plain three.js driven from React (components/ReefScene.jsx) through the small API returned at the end.
/* eslint-disable no-use-before-define */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {
  EffectComposer, RenderPass, EffectPass, BloomEffect, DepthOfFieldEffect, ToneMappingEffect, ToneMappingMode,
  HueSaturationEffect, BrightnessContrastEffect, VignetteEffect, Effect, BlendFunction,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';

export function createEngine({ canvas, stage, reefs, riskOf, getState, onPick, onGlobe, onCloseUp, onReturn, text, assets }) {
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Reefs in the short shape the scene uses
const REEFS = reefs.map((r) => ({ n: r.name, lat: r.lat, lon: r.lon, sd: r.ssta_sd, o: r.ocean, c: r.n }));
const T = () => text();

// Render quality. 'high': every effect (desktop). 'low': no depth of field, lighter shading (phones).
// 'off': plain render, no post-processing. Drops a level by itself if frames get slow.
// ?quality=high|low|off forces a level; ?debug exposes the effects on window.__rp for tuning.
const params = new URLSearchParams(window.location.search);
const forced = ['high', 'low', 'off'].includes(params.get('quality')) ? params.get('quality') : null;
const small = window.matchMedia('(max-width: 820px), (pointer: coarse)').matches;
let tier = forced || (small ? 'low' : 'high');
// With effects on, pixel ratio 1: depth of field and bloom soften the image anyway, and retina-density
// rendering costs ~2x the frame time (measured on a MacBook: 13 fps at 2x vs 43 fps at 1x).
const pixelRatioFor = (q) => Math.min(window.devicePixelRatio, q === 'off' ? 1.5 : 1);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(pixelRatioFor(tier));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 50);
camera.position.set(0.35, 1.45, 3.5);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.32, 0);
controls.enableDamping = true;
controls.minDistance = 0.35;
controls.maxDistance = 5;
controls.maxPolarAngle = Math.PI * 0.47; // stay above the sand
controls.autoRotate = !reduceMotion;
controls.autoRotateSpeed = 0.6;

// Fill comes mostly from the water itself (environment map, below); the sun is a strong key light for contrast.
const hemi = new THREE.HemisphereLight(0xbdf3fb, 0x0e2e66, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff6e8, 1.9);
sun.position.set(0.9, 3, 1.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -3.2; sun.shadow.camera.right = 3.2; sun.shadow.camera.top = 3.2; sun.shadow.camera.bottom = -3.2;
sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 6; sun.shadow.bias = -0.0008; sun.shadow.radius = 4;
scene.add(sun);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// ── Sand floor: rippled sand that fades into the page, with caustics and the colony's shadow ──
const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const sandU = { uSand: { value: new THREE.Color(cssVar('--sand') || '#DCD2BC') } };
const sandMat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, transparent: true, depthWrite: true });
sandMat.onBeforeCompile = (sh) => {
  Object.assign(sh.uniforms, U, sandU);
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vW;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvW = (modelMatrix * vec4(position, 1.0)).xyz;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>
      uniform float uTime; uniform float uCaustic; uniform vec3 uSand; varying vec3 vW;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float caustic(vec2 p, float t) {
        vec2 q = p * 6.0; float c = 0.0;
        c += sin(q.x * 1.3 + t * 0.9 + sin(q.y * 0.9 + t * 0.5) * 1.4);
        c += sin(q.y * 1.1 - t * 0.7 + sin(q.x * 1.2 - t * 0.4) * 1.6);
        c += sin((q.x + q.y) * 0.8 + t * 0.6);
        return pow(max(0.0, c / 3.0), 2.4);
      }`)
    .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
      float ripple = sin(vW.x * 26.0 + sin(vW.z * 7.0) * 1.8) * 0.5 + 0.5;
      float grain = h2(floor(vW.xz * 420.0));
      vec3 sand = uSand * (0.93 + ripple * 0.06 + grain * 0.05);
      float edge = 1.0 - smoothstep(1.5, 3.3, length(vW.xz));
      vec4 diffuseColor = vec4(sand, edge);`)
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance += uCaustic * caustic(vW.xz, uTime) * 0.35 * vec3(0.9, 0.98, 1.0) * diffuseColor.a;`);
};
// Seabed relief: flat where the main colony stands, sand mounds and dips further out.
const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
function seabed(x, z) {
  const m = smooth(0.85, 2.4, Math.hypot(x, z));
  return m * ((noise3(x * 0.7, 0.5, z * 0.7, 11) - 0.35) * 0.8 + (noise3(x * 1.9, 0.5, z * 1.9, 12) - 0.5) * 0.12);
}
const seabedGeo = new THREE.PlaneGeometry(7.2, 7.2, 180, 180);
seabedGeo.rotateX(-Math.PI / 2);
const sp0 = seabedGeo.attributes.position;
for (let i = 0; i < sp0.count; i++) sp0.setY(i, seabed(sp0.getX(i), sp0.getZ(i)));
seabedGeo.computeVertexNormals();
const sand = new THREE.Mesh(seabedGeo, sandMat);
sand.position.y = -0.01; sand.receiveShadow = true;
scene.add(sand);


// ── Water: the backdrop colour, also used as the fog colour, so distant reef dissolves into the water behind it ──
// Same gradient as the page background (top: surface, bottom: abyss, a sun glow top right), computed per pixel.
const srgbVec = (name, fb) => {
  const n = parseInt((cssVar(name) || fb).replace('#', ''), 16);
  return `vec3(${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => (v / 255).toFixed(4)).join(', ')})`;
};
const WATER_GLSL = `
vec3 rpWater(vec2 uv) {
  float t = clamp(1.0 - uv.y, 0.0, 1.0);
  vec3 c = t < 0.34 ? mix(${srgbVec('--surface', '#2C6FD6')}, ${srgbVec('--fog', '#17438C')}, t / 0.34)
         : t < 0.64 ? mix(${srgbVec('--fog', '#17438C')}, ${srgbVec('--bg', '#0E2E66')}, (t - 0.34) / 0.30)
         : mix(${srgbVec('--bg', '#0E2E66')}, ${srgbVec('--abyss', '#08193D')}, (t - 0.64) / 0.36);
  vec2 q = (vec2(uv.x, t) - vec2(0.62, -0.04)) / vec2(0.45, 0.35);
  c = mix(c, ${srgbVec('--sun', '#73E9FB')}, 0.7 * clamp(1.0 - length(q) / 0.7, 0.0, 1.0));
  return pow(c, vec3(2.2));
}`;
// Fog: colours fade to the water behind them; reds are absorbed first with distance, as under water.
// fogNear / fogFar carry the drawing-buffer height / width (set in resize) so the fog can find the backdrop pixel.
THREE.ShaderChunk.fog_pars_fragment = `#ifdef USE_FOG
  uniform vec3 fogColor; varying float vFogDepth; uniform float fogNear; uniform float fogFar;
  ${WATER_GLSL}
#endif`;
THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
  {
    vec2 rpUV = gl_FragCoord.xy / vec2(fogFar, fogNear);
    gl_FragColor.rgb *= exp(-max(vFogDepth - 3.2, 0.0) * vec3(0.22, 0.06, 0.03));
    gl_FragColor.rgb = mix(gl_FragColor.rgb, rpWater(rpUV), smoothstep(3.6, 9.0, vFogDepth));
  }
#endif`;
scene.fog = new THREE.Fog(cssVar('--fog') || '#17438C', 1, 1);
const syncSand = () => {
  sandU.uSand.value.set(cssVar('--sand') || '#DCD2BC');
  syncDecor();
  scene.fog.color.set(cssVar('--fog') || '#17438C');
  WATER.value.set(cssVar('--fog') || '#17438C');
};


// ── Shared uniforms ─────────────────────────────────────────────
const U = { uLevel: { value: 26 / 60 }, uTime: { value: 0 }, uCaustic: { value: 1 } };
const BONE = new THREE.Color('#ede6da');

// ── Seeded random + value noise ────────────────────────────────
function rng(seed) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function hash3(x, y, z, s) { const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + s * 19.3) * 43758.5453; return h - Math.floor(h); }
function noise3(x, y, z, s) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  let r = 0;
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) {
    r += hash3(xi + a, yi + b, zi + c, s) * (a ? u : 1 - u) * (b ? v : 1 - v) * (c ? w : 1 - w);
  }
  return r;
}

// ── Space colonisation: grow a branching colony ────────────────
// Growth forms: 'bush' (low dome, the main colony), 'table' (flat plate on a short stalk), 'tall' (staghorn).
function growColony(seed, shape = 'bush') {
  const R = rng(seed * 7919 + 17);
  const attractors = [];
  const target = shape === 'bush' ? 700 : shape === 'table' ? 420 : shape === 'fan' ? 900 : 300;
  while (attractors.length < target) {
    let y, rad;
    if (shape === 'fan') {
      const x = (R() * 2 - 1) * 0.6, y = 0.06 + R() * 0.85;
      if (Math.hypot(x / 0.6, (y - 0.06) / 0.85) > 1) continue;
      attractors.push([x, y, (R() - 0.5) * 0.03]);
      continue;
    } else if (shape === 'table') {
      if (R() < 0.12) { y = 0.08 + R() * 0.24; rad = 0.07; }      // stalk
      else { y = 0.34 + R() * 0.1; rad = 0.78; }                  // plate
    } else if (shape === 'tall') {
      y = 0.1 + R() * 1.15; rad = 0.14 + 0.32 * Math.sqrt((y - 0.06) / 1.2);
    } else {
      y = 0.1 + R() * 0.62; rad = 0.3 + 0.75 * Math.sqrt((y - 0.06) / 0.66);
    }
    const x = (R() * 2 - 1) * rad, z = (R() * 2 - 1) * rad;
    if (x * x + z * z < rad * rad) attractors.push([x, y, z]);
  }
  const nodes = []; // {p:[x,y,z], parent}
  const nRoots = shape === 'table' || shape === 'fan' ? 1 : shape === 'tall' ? 3 : 4 + Math.floor(R() * 3);
  for (let i = 0; i < nRoots; i++) {
    const a = (i / nRoots) * Math.PI * 2 + R() * 0.5;
    nodes.push({ p: [Math.cos(a) * 0.06, 0, Math.sin(a) * 0.06], parent: -1 });
  }
  const STEP = shape === 'fan' ? 0.028 : 0.036, INFL = 0.36, KILL = shape === 'fan' ? 0.055 : 0.11, CELL = INFL; // a larger kill distance = fewer, longer branches
  const key = (x, y, z) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)},${Math.floor(z / CELL)}`;
  const grid = new Map();
  const addToGrid = (i) => { const [x, y, z] = nodes[i].p; const k = key(x, y, z); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); };
  nodes.forEach((_, i) => addToGrid(i));
  const near = (x, y, z, f) => {
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), cz = Math.floor(z / CELL);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      const list = grid.get(`${cx + a},${cy + b},${cz + c}`); if (list) list.forEach(f);
    }
  };
  // Attractors in their own grid, so killing them near new nodes stays cheap.
  const dead = new Uint8Array(attractors.length);
  const agrid = new Map();
  attractors.forEach((a, i) => { const k = key(a[0], a[1], a[2]); if (!agrid.has(k)) agrid.set(k, []); agrid.get(k).push(i); });
  let alive = attractors.map((a, i) => i);
  for (let it = 0; it < 320 && alive.length && nodes.length < 4200; it++) {
    const pull = new Map();
    for (const ai of alive) {
      const at = attractors[ai];
      let best = -1, bd = INFL;
      near(at[0], at[1], at[2], (i) => { const p = nodes[i].p; const d = Math.hypot(p[0] - at[0], p[1] - at[1], p[2] - at[2]); if (d < bd) { bd = d; best = i; } });
      if (best >= 0) {
        const p = nodes[best].p; const v = pull.get(best) || [0, 0, 0, 0];
        v[0] += (at[0] - p[0]) / bd; v[1] += (at[1] - p[1]) / bd; v[2] += (at[2] - p[2]) / bd; v[3]++;
        pull.set(best, v);
      }
    }
    if (!pull.size) {
      // Nothing in reach yet (the very start): push the roots straight up.
      for (let i = 0; i < nRoots; i++) {
        let tip = i; while (true) { const c = nodes.findIndex((m) => m.parent === tip); if (c < 0) break; tip = c; }
        const p = nodes[tip].p; nodes.push({ p: [p[0] * 1.15, p[1] + STEP, p[2] * 1.15], parent: tip }); addToGrid(nodes.length - 1);
      }
      continue;
    }
    const born = [];
    pull.forEach((v, i) => {
      let dx = v[0] / v[3], dy = v[1] / v[3] + 0.1, dz = v[2] / v[3];
      dx += (R() - 0.5) * 0.25; dz += (R() - 0.5) * 0.25;
      const l = Math.hypot(dx, dy, dz) || 1; const p = nodes[i].p;
      nodes.push({ p: [p[0] + dx / l * STEP, p[1] + dy / l * STEP, p[2] + dz / l * STEP], parent: i });
      born.push(nodes.length - 1); addToGrid(nodes.length - 1);
    });
    for (const j of born) {
      const p = nodes[j].p;
      const cx = Math.floor(p[0] / CELL), cy = Math.floor(p[1] / CELL), cz = Math.floor(p[2] / CELL);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
        const list = agrid.get(`${cx + a},${cy + b},${cz + c}`); if (!list) continue;
        for (const ai of list) { if (dead[ai]) continue; const at = attractors[ai]; if (Math.hypot(p[0] - at[0], p[1] - at[1], p[2] - at[2]) < KILL) dead[ai] = 1; }
      }
    }
    alive = alive.filter((ai) => !dead[ai]);
  }
  // Thickness from the number of descendants (pipe model, Acropora keeps blunt tips).
  const desc = new Array(nodes.length).fill(1);
  for (let i = nodes.length - 1; i >= 0; i--) if (nodes[i].parent >= 0) desc[nodes[i].parent] += desc[i];
  let maxY = 0; nodes.forEach((n) => { maxY = Math.max(maxY, n.p[1]); });
  nodes.forEach((n, i) => {
    n.r = Math.min(0.07, 0.009 + 0.0052 * Math.sqrt(desc[i]));
    n.leaf = desc[i] === 1;
    const h = n.p[1] / maxY;
    const tipness = Math.min(1, desc[i] / 60);
    // Lower key = bleaches earlier: high and young (tip) tissue first, in patches.
    n.key = Math.min(1, Math.max(0, 0.48 * (1 - h) + 0.27 * tipness + 0.25 * noise3(n.p[0] * 4, n.p[1] * 4, n.p[2] * 4, seed)));
    n.violet = noise3(n.p[0] * 2.2 + 9, n.p[1] * 2.2, n.p[2] * 2.2, seed + 5) < 0.4;
  });
  // Remove short side stubs (fewer than 4 segments from their fork): they read as thorns
  const kids = new Array(nodes.length).fill(0);
  nodes.forEach((n) => { if (n.parent >= 0) kids[n.parent]++; });
  const drop = new Set();
  nodes.forEach((n, i) => {
    if (!n.leaf || n.parent < 0) return;
    const chain = [i]; let j = n.parent;
    while (j >= 0 && kids[j] === 1 && chain.length < 4) { chain.push(j); j = nodes[j].parent; }
    if (chain.length < 4 && j >= 0) chain.forEach((c) => drop.add(c));
  });
  if (drop.size) {
    const keep = nodes.map((_, i) => !drop.has(i)), map = new Array(nodes.length);
    let k = 0; nodes.forEach((n, i) => { if (keep[i]) map[i] = k++; });
    const pruned = nodes.filter((_, i) => keep[i]).map((n) => ({ ...n, parent: n.parent >= 0 ? map[n.parent] : -1 }));
    nodes.length = 0; pruned.forEach((n) => nodes.push(n));
    const kids2 = new Array(nodes.length).fill(0);
    nodes.forEach((n) => { if (n.parent >= 0) kids2[n.parent]++; });
    nodes.forEach((n, i) => { n.leaf = kids2[i] === 0; });
  }
  // Spread keys evenly (rank order), so the share of white tissue follows the risk level.
  const order = nodes.map((n, i) => i).sort((a, b) => nodes[a].key - nodes[b].key);
  order.forEach((i, rank) => { nodes[i].key = rank / (order.length - 1); });
  return nodes;
}

// ── Material: bleaching + caustics injected into the standard shader ──
const WATER = { value: new THREE.Color(cssVar('--fog') || '#17438C') };
// soft: width of the white edge; larger = a gradual paling instead of a sharp front
// lag: background corals (mute > 0) bleach later than the specimen (level^lag), so the reef around it
// still looks alive at moderate risk and catches up at extreme risk. The specimen shows the model's risk as is.
function coralMaterial(mute = 0, soft = 0.15, lag = mute > 0 ? 1.8 : 1) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U, { uBone: { value: BONE }, uMute: { value: mute }, uWater: WATER, uSoft: { value: soft }, uLag: { value: lag } });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aKey; attribute vec3 aBase; attribute float aGroove; varying float vKey; varying vec3 vBase; varying vec3 vW; varying float vGroove;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vKey = aKey; vBase = aBase; vGroove = aGroove;
        #ifdef USE_INSTANCING
          vW = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
        #else
          vW = (modelMatrix * vec4(position, 1.0)).xyz;
        #endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uLevel; uniform float uTime; uniform float uCaustic; uniform vec3 uBone; uniform float uMute; uniform vec3 uWater; uniform float uSoft; uniform float uLag;
        varying float vKey; varying vec3 vBase; varying vec3 vW; varying float vGroove;
        float caustic(vec2 p, float t) {
          vec2 q = p * 6.0;
          float c = 0.0;
          c += sin(q.x * 1.3 + t * 0.9 + sin(q.y * 0.9 + t * 0.5) * 1.4);
          c += sin(q.y * 1.1 - t * 0.7 + sin(q.x * 1.2 - t * 0.4) * 1.6);
          c += sin((q.x + q.y) * 0.8 + t * 0.6);
          return pow(max(0.0, c / 3.0), 2.4);
        }`)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
        float bl = smoothstep(vKey * (1.0 - uSoft), vKey * (1.0 - uSoft) + uSoft, pow(clamp(uLevel, 0.0, 1.0), uLag));
        // bleached skeleton keeps its relief: valleys stay a faint grey-pink
        vec3 skel = mix(uBone, uBone * vec3(0.8, 0.72, 0.72), vGroove);
        vec3 tissue = mix(vBase, skel, bl);
        float grey = dot(tissue, vec3(0.299, 0.587, 0.114));
        tissue = mix(tissue, mix(vec3(grey), uWater, 0.55), uMute);
        vec4 diffuseColor = vec4(tissue, opacity);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += uCaustic * caustic(vW.xz, uTime) * clamp(normal.y * 0.5 + 0.6, 0.0, 1.0) * 0.6 * vec3(0.85, 0.97, 1.0);
        totalEmissiveRadiance += bl * 0.16 * uBone; // bleached skeleton reads bright white`);
  };
  return m;
}

// ── Build the meshes for one colony ────────────────────────────
const group = new THREE.Group();
scene.add(group);
let algae, focusTip = new THREE.Vector3(0, 1, 0);
// Realistic Acropora: golden-brown and olive colour morphs (the brown is the algae), paler lavender growing tips.
const CORAL = new THREE.Color('#A87B44'), VIOLET = new THREE.Color('#7D7845'), TIP = new THREE.Color('#A99BE0');
// Thin, young branch ends carry fewer algae: they fade to the tip colour
const tissueOf = (n) => (n.violet ? VIOLET : CORAL).clone().lerp(TIP, Math.max(0, Math.min(1, (0.026 - n.r) / 0.016)) * 0.8);

function build(seed, target = group, opts = { shape: 'bush', detail: true, mute: 0 }) {
  target.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  target.clear();
  const nodes = growColony(seed, opts.shape);
  const R = rng(seed * 31 + 7);
  const segs = nodes.filter((n) => n.parent >= 0);
  const mat = coralMaterial(opts.mute);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();

  const keysOf = (count) => new Float32Array(count);
  // Branch segments
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 9, 1, true); cyl.translate(0, 0.5, 0);
  const branches = new THREE.InstancedMesh(cyl, mat, segs.length);
  const bKey = keysOf(segs.length), bBase = new Float32Array(segs.length * 3);
  segs.forEach((n, i) => {
    const a = nodes[n.parent].p, b = n.p;
    P.set(a[0], a[1], a[2]); dir.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = dir.length(); dir.normalize(); Q.setFromUnitVectors(up, dir);
    const r = (n.r + nodes[n.parent].r) / 2; S.set(r, len * 1.02, r);
    branches.setMatrixAt(i, M.compose(P, Q, S));
    bKey[i] = n.key; tissueOf(n).toArray(bBase, i * 3);
  });
  cyl.setAttribute('aKey', new THREE.InstancedBufferAttribute(bKey, 1));
  cyl.setAttribute('aBase', new THREE.InstancedBufferAttribute(bBase, 3));
  branches.castShadow = true;
  target.add(branches);

  // Joints and blunt tips
  const sph = new THREE.IcosahedronGeometry(1, 2);
  const inner = nodes.filter((n) => !n.leaf);
  const joints = new THREE.InstancedMesh(sph, mat, inner.length);
  const jKey = keysOf(inner.length), jBase = new Float32Array(inner.length * 3);
  inner.forEach((n, i) => {
    P.set(n.p[0], n.p[1], n.p[2]); S.setScalar(n.r); Q.identity();
    joints.setMatrixAt(i, M.compose(P, Q, S)); jKey[i] = n.key; tissueOf(n).toArray(jBase, i * 3);
  });
  sph.setAttribute('aKey', new THREE.InstancedBufferAttribute(jKey, 1));
  sph.setAttribute('aBase', new THREE.InstancedBufferAttribute(jBase, 3));
  joints.castShadow = true;
  target.add(joints);

  // Pointed tips: a slim cone continuing each terminal branch (Acropora's axial corallite)
  const leaves = nodes.filter((n) => n.leaf && n.parent >= 0);
  const cone = new THREE.ConeGeometry(1, 1, 10, 1, true); cone.translate(0, 0.5, 0);
  const tips = new THREE.InstancedMesh(cone, mat, leaves.length);
  const tKey = keysOf(leaves.length), tBase = new Float32Array(leaves.length * 3);
  leaves.forEach((n, i) => {
    const a = nodes[n.parent].p;
    dir.set(n.p[0] - a[0], n.p[1] - a[1], n.p[2] - a[2]).normalize();
    P.set(n.p[0], n.p[1], n.p[2]); Q.setFromUnitVectors(up, dir); S.set(n.r * 1.02, n.r * 2.6, n.r * 1.02);
    tips.setMatrixAt(i, M.compose(P, Q, S)); tKey[i] = n.key;
    TIP.clone().lerp(BONE, 0.2).toArray(tBase, i * 3);   // pale lavender axial corallite
  });
  cone.setAttribute('aKey', new THREE.InstancedBufferAttribute(tKey, 1));
  cone.setAttribute('aBase', new THREE.InstancedBufferAttribute(tBase, 3));
  tips.castShadow = true;
  target.add(tips);

  if (opts.detail) {
  // Corallites (polyps): small bumps on the surface, slightly lighter
  const polypGeo = new THREE.IcosahedronGeometry(1, 1);
  const per = 12; // many small corallites, as on a real Acropora branch
  const polyps = new THREE.InstancedMesh(polypGeo, mat, segs.length * per);
  const pKey = keysOf(segs.length * per), pBase = new Float32Array(segs.length * per * 3);
  const algaePos = [], algaeKey = [], algaeSeed = [];
  const side = new THREE.Vector3(), tmp = new THREE.Vector3();
  let k = 0;
  segs.forEach((n) => {
    const a = nodes[n.parent].p, b = n.p;
    dir.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
    side.set(1, 0, 0); if (Math.abs(dir.x) > 0.9) side.set(0, 0, 1);
    side.cross(dir).normalize();
    for (let j = 0; j < per; j++) {
      const t = R(), ang = R() * Math.PI * 2;
      tmp.copy(side).applyAxisAngle(dir, ang);
      P.set(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t).addScaledVector(tmp, n.r * 0.96);
      S.setScalar(Math.max(0.003, n.r * 0.13)); Q.identity();
      polyps.setMatrixAt(k, M.compose(P, Q, S)); pKey[k] = n.key;
      const c = tissueOf(n).lerp(BONE, 0.28); c.toArray(pBase, k * 3);
      if (R() < 0.1) { algaePos.push(P.x + tmp.x * 0.004, P.y + tmp.y * 0.004, P.z + tmp.z * 0.004); algaeKey.push(n.key); algaeSeed.push(R()); }
      k++;
    }
  });
  polypGeo.setAttribute('aKey', new THREE.InstancedBufferAttribute(pKey, 1));
  polypGeo.setAttribute('aBase', new THREE.InstancedBufferAttribute(pBase, 3));
  target.add(polyps);

  // Algae: points that drift up and fade once their tissue bleaches
  const ag = new THREE.BufferGeometry();
  ag.setAttribute('position', new THREE.Float32BufferAttribute(algaePos, 3));
  ag.setAttribute('aKey', new THREE.Float32BufferAttribute(algaeKey, 1));
  ag.setAttribute('aSeed', new THREE.Float32BufferAttribute(algaeSeed, 1));
  algae = new THREE.Points(ag, algaeMaterial());
  target.add(algae);
  }

  // Soft contact shadow under the colony
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.1, 48), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec2 vUv; void main(){ float d = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(0.05, 0.16, 0.25, 0.28 * smoothstep(0.75, 0.0, d)); }',
  }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.0;
  target.add(shadow);

  if (!opts.detail) return;
  // Close-up target: a high tip on the camera side
  let best = null;
  nodes.forEach((n) => { if (n.p[1] > 0.3 && (!best || n.p[1] + n.p[2] * 0.6 > best.p[1] + best.p[2] * 0.6)) best = n; });
  if (best) focusTip.set(best.p[0], best.p[1] - 0.04, best.p[2]);
}

function algaeMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { ...U, uSize: { value: 16 * renderer.getPixelRatio() } },
    vertexShader: `
      uniform float uLevel; uniform float uTime; uniform float uSize;
      attribute float aKey; attribute float aSeed; varying float vA;
      void main() {
        float bl = smoothstep(aKey * 0.85, aKey * 0.85 + 0.15, uLevel);
        float t = uTime * (0.25 + aSeed * 0.3) + aSeed * 20.0;
        vec3 p = position;
        float rise = fract(t * 0.15) * bl;
        p += vec3(sin(t + aSeed * 6.0) * 0.04, rise * (0.25 + aSeed * 0.35), cos(t * 0.8 + aSeed * 4.0) * 0.04) * bl;
        vA = (1.0 - bl * 0.55) * (1.0 - rise * 0.9);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uSize * (0.5 + aSeed * 0.5) / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        gl_FragColor = vec4(0.84, 0.66, 0.29, vA * smoothstep(0.5, 0.35, d));
      }`,
  });
}

// ── Massive corals: brain (meandering valleys) and boulder (lumpy dome). They bleach too. ──
const BRAIN_RIDGE = new THREE.Color('#C9A24A'), BRAIN_VALLEY = new THREE.Color('#6B5A2E');
function buildMassive(seed, target, opts) {
  target.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  target.clear();
  const brain = opts.shape === 'brain';
  const geo = new THREE.SphereGeometry(1, opts.detail ? 460 : 150, opts.detail ? 260 : 90, 0, Math.PI * 2, 0, Math.PI * (brain ? 0.62 : 0.56));
  const pos = geo.attributes.position, v = new THREE.Vector3();
  const n = pos.count, keys = new Float32Array(n), base = new Float32Array(n * 3), groove = new Float32Array(n), ridgeLine = new Float32Array(n);
  const W = brain ? 0.6 : 0.5, Hh = brain ? 0.72 : 0.46;   // the brain is a tall, rounded dome
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i);
    let r = 1;
    if (brain) {
      const p = v.clone().multiplyScalar(2.6);
      const w = (noise3(p.x * 0.7, p.y * 0.7, p.z * 0.7, seed) - 0.5) * 2.6;
      // smooth field (two octaves) so its contour lines bend gently instead of packing up
      const m = 0.65 * noise3(p.x + w, p.y - w, p.z + w * 0.5, seed + 3) + 0.35 * noise3(p.x * 1.7 - w, p.y * 1.7, p.z * 1.7 + w, seed + 4);
      const ph = Math.cos(m * 30 * Math.PI);           // +1 on the ridge crest, -1 on the valley floor
      groove[i] = Math.pow(0.5 - ph * 0.5, 3);         // narrow valleys
      const crest = Math.pow(0.5 + ph * 0.5, 30);      // fine line along each ridge
      ridgeLine[i] = crest;
      // tubular ridges, deep narrow valleys, a shallow line on the crest
      r = 1 - groove[i] * 0.075 - crest * 0.004;
    } else {
      // lobes, then the fine bumpy skin of Porites
      r = 1 + (noise3(v.x * 2.4, v.y * 2.4, v.z * 2.4, seed) - 0.5) * 0.38 + (noise3(v.x * 7, v.y * 7, v.z * 7, seed + 1) - 0.5) * 0.08
        + (noise3(v.x * 26, v.y * 26, v.z * 26, seed + 2) - 0.5) * 0.035;
    }
    const y = Math.max(0, v.y);
    pos.setXYZ(i, v.x * W * r, (y * Hh * r) - 0.02, v.z * W * r);
    const h = y;
    if (brain) {
      // Bleaching starts on the sunlit crown and spreads as one front with a ragged edge
      keys[i] = 0.6 * (1 - h) + 0.32 * noise3(v.x * 2.6, v.y * 2.6, v.z * 2.6, seed + 7) + 0.08 * noise3(v.x * 18, v.y * 18, v.z * 18, seed + 8);
    } else {
      keys[i] = 0.55 * (1 - h) + 0.45 * noise3(v.x * 3.5, v.y * 3.5, v.z * 3.5, seed + 7);
    }
    let c;
    if (brain) {
      // golden ochre ridges, olive-brown valleys, a darker line on the crest
      c = BRAIN_RIDGE.clone().lerp(BRAIN_VALLEY, Math.min(1, groove[i] * 1.3)).lerp(BRAIN_VALLEY, ridgeLine[i] * 0.45)
        .multiplyScalar(0.94 + noise3(v.x * 6, v.y * 6, v.z * 6, seed + 9) * 0.12);
    } else {
      const violet = noise3(v.x * 1.8 + 9, v.y * 1.8, v.z * 1.8, seed + 5) < 0.4;
      c = (violet ? VIOLET : CORAL).clone();
    }
    c.toArray(base, i * 3);
  }
  // rank-normalise so the white share follows the risk level, as on the branching colony
  const order = Array.from(keys.keys()).sort((a, b) => keys[a] - keys[b]);
  order.forEach((i, rank) => { keys[i] = rank / (n - 1); });
  geo.setAttribute('aKey', new THREE.BufferAttribute(keys, 1));
  geo.setAttribute('aBase', new THREE.BufferAttribute(base, 3));
  geo.setAttribute('aGroove', new THREE.BufferAttribute(groove, 1));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, coralMaterial(opts.mute, brain ? 0.05 : 0.25));
  mesh.castShadow = true; mesh.receiveShadow = true;
  target.add(mesh);
  if (!opts.detail) return;

  // Algae on the surface, as on the branching colony
  const R = rng(seed * 31 + 7), ap = [], ak = [], as = [], nrm = geo.attributes.normal;
  for (let i = 0; i < n; i += 7) {
    if (R() > (brain ? 0.18 : 0.5) || pos.getY(i) < 0.02) continue;
    ap.push(pos.getX(i) + nrm.getX(i) * 0.006, pos.getY(i) + nrm.getY(i) * 0.006, pos.getZ(i) + nrm.getZ(i) * 0.006);
    ak.push(keys[i]); as.push(R());
  }
  const ag = new THREE.BufferGeometry();
  ag.setAttribute('position', new THREE.Float32BufferAttribute(ap, 3));
  ag.setAttribute('aKey', new THREE.Float32BufferAttribute(ak, 1));
  ag.setAttribute('aSeed', new THREE.Float32BufferAttribute(as, 1));
  algae = new THREE.Points(ag, algaeMaterial());
  target.add(algae);
  focusTip.set(0.05, Hh * 0.88, W * 0.38);
}
function buildAny(seed, target = group, opts = { shape: 'bush', detail: true, mute: 0 }) {
  if (opts.shape === 'brain' || opts.shape === 'boulder') buildMassive(seed, target, opts);
  else build(seed, target, opts);
}

let seed = 3;
build(seed);

// ── The reef around the specimen ────────────────────────────────
// Branching colonies that bleach with the model (muted), plus decor that does not bleach:
// sea fans and sponges have no symbiotic algae (most gorgonians, all sponges), live rock is rock.
const DECOR_MUTE = 0.06;
const muted = (hex, k = DECOR_MUTE) => {
  const c = new THREE.Color(hex), g = (c.r * 0.299 + c.g * 0.587 + c.b * 0.114);
  return c.lerp(new THREE.Color(g, g, g).lerp(WATER.value, 0.5), k);
};
const decorMats = [];
function decorMaterial(hex, opts = {}) {
  const m = new THREE.MeshStandardMaterial({ color: muted(hex), roughness: opts.roughness ?? 0.9, metalness: 0 });
  m.userData.hex = hex;
  decorMats.push(m);
  return m;
}
function syncDecor() { decorMats.forEach((m) => m.color.copy(muted(m.userData.hex))); }

const rocks = [];
// Live rock: lumpy, porous, mottled with coralline algae (pink, purple), green turf and brown film
// pScale: noise frequency for the mottling (procedural rocks are ~2 units across, scans are normalised to 1)
function makeRockMat(pScale = 1, seed = 0, normalMap = null) {
const liveRockMat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, normalMap });
liveRockMat.onBeforeCompile = (sh) => {
  Object.assign(sh.uniforms, { uMute: { value: 0.08 }, uWater: WATER, uPScale: { value: pScale }, uSeed: { value: seed } });
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vP; uniform float uPScale; uniform float uSeed;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvP = position * uPScale + uSeed;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>
      uniform float uMute; uniform vec3 uWater; varying vec3 vP;
      float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
    .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
      float a = n3(vP * 3.0), b = n3(vP * 7.0 + 11.0), c = n3(vP * 18.0 + 5.0), pores = n3(vP * 34.0);
      vec3 col = vec3(0.55, 0.50, 0.42);                                    // bare rock
      col = mix(col, vec3(0.80, 0.50, 0.56), smoothstep(0.45, 0.62, a));   // pink coralline
      col = mix(col, vec3(0.47, 0.33, 0.47), smoothstep(0.62, 0.78, b));   // purple coralline
      col = mix(col, vec3(0.55, 0.62, 0.36), smoothstep(0.58, 0.72, n3(vP * 4.5 + 3.0)) * 0.9); // green turf
      col *= (0.85 + c * 0.3) * 0.72;                                        // speckle, and a darker rock overall
      col *= mix(1.0, 0.45, smoothstep(0.72, 0.82, pores));                 // pores
      float g = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, mix(vec3(g), uWater, 0.5), uMute);
      vec4 diffuseColor = vec4(col, opacity);`);
};
return liveRockMat;
}
const liveRockMat = makeRockMat();

// Scanned rocks (Poly Haven, CC0): their shape and relief, painted with the live-rock shader
const ROCK_KINDS = ['rock_crag', 'rock_slab', 'rock_round'];
const rockTemplates = {};
function loadRocks() {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  return Promise.all(ROCK_KINDS.map((kind) => new Promise((resolve) => {
    loader.load(`${assets}/models/${kind}${process.env.REACT_APP_SCAN_EXT || '.glb'}`, (res) => {
      res.scene.updateMatrixWorld(true);
      res.scene.traverse((o) => {
        if (o.isMesh && !rockTemplates[kind]) {
          const geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
          geo.computeBoundingBox();
          rockTemplates[kind] = { geo, normalMap: o.material.normalMap || null };
        }
      });
      resolve();
    }, undefined, () => resolve());
  })));
}
let rockCount = 0;
function liveRock(seed, r) {
  const t = rockTemplates[ROCK_KINDS[rockCount++ % ROCK_KINDS.length]];
  if (t) {
    const m = new THREE.Mesh(t.geo, makeRockMat(2.4, seed * 3.7, t.normalMap));
    m.scale.setScalar(r * 2.1);
    rocks.push(m);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  // fallback while (or if) the scans can't load: a lumpy procedural rock
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, 5).deleteAttribute('normal').deleteAttribute('uv'));
  const pos = g.attributes.position, v = new THREE.Vector3();
  for (let k = 0; k < pos.count; k++) {
    v.fromBufferAttribute(pos, k);
    const d = 0.7 + noise3(v.x * 1.4 + seed, v.y * 1.4, v.z * 1.4, seed) * 0.5 + (noise3(v.x * 5, v.y * 5, v.z * 5, seed + 1) - 0.5) * 0.14;
    v.multiplyScalar(d);
    if (v.y < -0.2) v.y = -0.2 + (v.y + 0.2) * 0.3; // flatter base
    pos.setXYZ(k, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, liveRockMat);
  m.scale.set(r * 1.35, r * 0.8, r);
  rocks.push(m);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// Sea fan (gorgonian): a flat, finely branched fan grown in one plane
function seaFan(seed, h, hex) {
  const nodes = growColony(seed, 'fan');
  const mat = decorMaterial(hex, { roughness: 0.8 });
  const segs = nodes.filter((n) => n.parent >= 0);
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true); cyl.translate(0, 0.5, 0);
  const mesh = new THREE.InstancedMesh(cyl, mat, segs.length);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
  segs.forEach((n, i) => {
    const a = nodes[n.parent].p, b = n.p;
    P.set(a[0], a[1], a[2]); dir.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = dir.length(); dir.normalize(); Q.setFromUnitVectors(up, dir);
    const r = Math.max(0.004, n.r * 0.32); S.set(r, len * 1.05, r);
    mesh.setMatrixAt(i, M.compose(P, Q, S));
  });
  mesh.castShadow = true;
  const g = new THREE.Group(); g.add(mesh); g.scale.setScalar(h);
  return g;
}

// Sponges: a barrel sponge (open vase) and encrusting blobs
function barrelSponge(seed, r, hex) {
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    pts.push(new THREE.Vector2(0.55 + Math.sin(t * Math.PI * 0.85) * 0.35 - (i === 12 ? 0.08 : 0), t * 1.3));
  }
  for (let i = 12; i >= 2; i--) pts.push(new THREE.Vector2(pts[i].x - 0.14, pts[i].y - 0.06)); // inner wall
  const g = new THREE.LatheGeometry(pts, 40);
  const pos = g.attributes.position, v = new THREE.Vector3();
  for (let k = 0; k < pos.count; k++) {
    v.fromBufferAttribute(pos, k);
    const ridge = Math.sin(Math.atan2(v.z, v.x) * 14) * 0.025;
    const s = 1 + ridge + (noise3(v.x * 3, v.y * 3, v.z * 3, seed) - 0.5) * 0.12;
    pos.setXYZ(k, v.x * s, v.y, v.z * s);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, decorMaterial(hex, { roughness: 1 }));
  m.material.side = THREE.DoubleSide;
  m.scale.setScalar(r); m.castShadow = true; m.receiveShadow = true;
  return m;
}
function blob(seed, r, hex, flat = 0.45) {
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, 4).deleteAttribute('normal').deleteAttribute('uv'));
  const pos = g.attributes.position, v = new THREE.Vector3();
  for (let k = 0; k < pos.count; k++) {
    v.fromBufferAttribute(pos, k);
    v.multiplyScalar(0.8 + noise3(v.x * 2.2, v.y * 2.2, v.z * 2.2, seed) * 0.4 + (noise3(v.x * 9, v.y * 9, v.z * 9, seed + 2) - 0.5) * 0.08);
    pos.setXYZ(k, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, decorMaterial(hex));
  m.scale.set(r * 1.2, r * flat, r); m.castShadow = true; m.receiveShadow = true;
  return m;
}

const reefBack = new THREE.Group();
scene.add(reefBack);
const place = (obj, x, z, sink = 0, rotY = 0) => { obj.position.set(x, seabed(x, z) - sink, z); obj.rotation.y = rotY; reefBack.add(obj); };

// Positions sit behind and to the right of the main colony (the camera looks from +z; the sentence covers the far left).
const REEF = [
  () => place(liveRock(3, 0.55), 1.35, -1.45, 0.12, 0.4),
  () => place(liveRock(5, 0.5), -0.6, -1.95, 0.1, 1.2),
  () => place(liveRock(8, 0.42), 2.45, -0.85, 0.1, 2.0),
  () => place(liveRock(9, 0.62), 0.35, -2.7, 0.12, 0.9),
  () => place(liveRock(12, 0.26), -1.15, -0.7, 0.06, 0.3),
  () => place(liveRock(14, 0.17), 1.15, 0.75, 0.04, 1.7),
  () => place(seaFan(21, 0.95, '#C2245C'), 0.95, -2.15, 0, 0.15),
  () => place(seaFan(23, 0.7, '#B8325E'), 2.35, -1.7, 0, -0.5),
  () => place(barrelSponge(4, 0.22, '#D9782E'), 1.95, -0.25, 0.02),
  () => place(blob(6, 0.16, '#E2B43A', 0.35), 1.2, -1.0, 0.03),
  () => place(blob(7, 0.12, '#E07A3A', 0.4), -0.25, -1.5, 0.03),
  () => { const g = new THREE.Group(); buildMassive(52, g, { shape: 'boulder', detail: false, mute: 0.5 }); g.scale.setScalar(0.7); place(g, 2.65, 0.2, 0.02); },
];
// Branching colonies of the same kind as the specimen: they bleach with it, muted
const BACK = [
  { shape: 'table', x: 1.55, z: -0.45, s: 0.55 },
  { shape: 'tall', x: -0.15, z: -2.25, s: 0.42 }, { shape: 'table', x: 1.85, z: -2.25, s: 0.62 },
];
// Build the reef once the rock scans are in (or after 3 s), then the scans that sit on the rocks
const REEF_T = 250 + (REEF.length + BACK.length) * 60;   // when the hand-placed reef is complete
let reefStarted = false;
const startReef = () => {
  if (reefStarted || disposed) return;
  reefStarted = true;
  [...REEF, ...BACK.map((c, i) => () => {
    const g = new THREE.Group();
    build(40 + i * 7, g, { shape: c.shape, detail: false, mute: 0.5 });
    g.scale.setScalar(c.s);
    place(g, c.x, c.z, 0.02, i * 1.7);
  })].forEach((fn, i) => setTimeout(fn, 250 + i * 60));
  setTimeout(loadScans, REEF_T + 200);
  setTimeout(loadCritters, REEF_T + 600);
  setTimeout(loadSwimmers, REEF_T + 1000);
};

// ── Scanned corals: real skeletons (Smithsonian Institution, CC0), given live tissue colour by the coral
//    shader so they bleach with the model like everything else. Each sits on its rock or on the sand.
// file, x, z, size (largest dimension), turn, sink, tissue colour, paler tip colour, on a rock?
const SCANS = [
  ['diploria', -1.0, -1.15, 0.5, 0.6, 0.03, '#B3893C', '#D8C27A', false],   // brain coral, golden brown
  ['acropora', 1.3, -1.45, 0.62, 2.2, 0.05, '#A0954F', '#C4B6EC', true],    // tabletop Acropora, olive with lavender tips
  ['millepora', 2.45, -0.85, 0.5, 0.9, 0.04, '#C9A447', '#F1E4A8', true],   // fire coral, mustard yellow, white tips
  ['seriatopora', -0.6, -1.95, 0.46, 1.4, 0.04, '#D0869F', '#F4C9D6', true], // bird's-nest coral, pink
  ['pocillopora', 2.1, -1.2, 0.42, 0.2, 0.03, '#A9745F', '#E0B7A4', false], // cauliflower coral, pinkish brown
  ['favia', 1.15, 0.75, 0.2, 0.4, 0.03, '#8E8A3A', '#C9C27A', true],        // small massive coral on the near rock
];
const down = new THREE.Raycaster(), downDir = new THREE.Vector3(0, -1, 0), from = new THREE.Vector3();
function surfaceAt(x, z, onRock) {
  if (onRock && rocks.length) {
    reefBack.updateMatrixWorld(true);
    down.set(from.set(x, 3, z), downDir);
    const hit = down.intersectObjects(rocks, false)[0];
    if (hit) return hit.point.y;
  }
  return seabed(x, z);
}
function dressScan(mesh, tissueHex, tipHex) {
  const g = mesh.geometry, pos = g.attributes.position, n = pos.count;
  g.computeBoundingBox();
  const { min, max } = g.boundingBox, h = Math.max(1e-6, max.y - min.y);
  const base = new THREE.Color(tissueHex), tip = new THREE.Color(tipHex), c = new THREE.Color();
  const aBase = new Float32Array(n * 3), raw = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), hn = (y - min.y) / h;
    const nz = noise3(x * 9, y * 9, z * 9, 7);
    // upper surfaces pale towards the tip colour and bleach first
    c.copy(base).lerp(tip, Math.max(0, Math.min(1, (hn - 0.55) * 1.6)) * 0.7).multiplyScalar(0.9 + nz * 0.2);
    aBase.set([c.r, c.g, c.b], i * 3);
    raw[i] = (1 - hn) * 0.55 + nz * 0.45;
  }
  const order = Array.from(raw.keys()).sort((a, b) => raw[a] - raw[b]), keys = new Float32Array(n);
  order.forEach((i, rank) => { keys[i] = rank / (n - 1); });
  g.setAttribute('aBase', new THREE.BufferAttribute(aBase, 3));
  g.setAttribute('aKey', new THREE.BufferAttribute(keys, 1));
  g.setAttribute('aGroove', new THREE.BufferAttribute(new Float32Array(n), 1));
  const src = mesh.material, m = coralMaterial(0.22, 0.2);
  m.normalMap = src.normalMap || null; m.aoMap = src.aoMap || null; m.aoMapIntensity = 1;
  if (src.normalScale) m.normalScale.copy(src.normalScale);
  src.dispose();
  mesh.material = m; mesh.castShadow = true; mesh.receiveShadow = true;
}
const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
function loadScans() {
  SCANS.forEach(([file, x, z, size, rot, sink, tissue, tipHex, onRock]) => {
    gltf.load(scanURL(file), (res) => {
      if (disposed) return;
      const obj = res.scene;
      obj.traverse((o) => { if (o.isMesh) dressScan(o, tissue, tipHex); });
      obj.scale.setScalar(size); obj.rotation.y = rot;
      obj.position.set(x, surfaceAt(x, z, onRock) - sink, z);
      reefBack.add(obj);
    }, undefined, (err) => console.warn('Reef Pulse: could not load scan', file, err));
  });
}
// After the hand-built reef is in place (rocks are needed to find where each scan sits)

// ── Reef life scans (ffish.asia / floraZia.com, CC0): a clam and an urchin on the reef, and now and then
//    a larger fish crosses. Fish swim with a body wave in the vertex shader, so no animation data is needed.
const scanURL = (file) => `${assets}/models/${file}${process.env.REACT_APP_SCAN_EXT || '.glb'}`;
const CRITTERS = [
  // file, x, z, size, turn, sink, on a rock?
  ['clam', -1.15, -0.7, 0.2, 2.4, 0.03, true],   // boring clam, Tridacna crocea, set into the rock
  ['urchin', 0.95, -0.95, 0.15, 0.8, 0.02, false],
];
function loadCritters() {
  CRITTERS.forEach(([file, x, z, size, rot, sink, onRock]) => {
    gltf.load(scanURL(file), (res) => {
      if (disposed) return;
      const obj = res.scene;
      obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.material.roughness = 0.75; o.material.metalness = 0; } });
      obj.scale.setScalar(size); obj.rotation.y = rot;
      obj.position.set(x, surfaceAt(x, z, onRock) - sink, z);
      reefBack.add(obj);
    });
  });
}

const SWIMMERS = [
  { file: 'parrotfish', size: 0.34, count: [1, 1], speed: 0.2, beat: 5 },
  { file: 'coralfish', size: 0.2, count: [1, 3], speed: 0.26, beat: 7 },
  { file: 'angelfish', size: 0.21, count: [1, 2], speed: 0.24, beat: 6 },
];
const swimTemplates = {};
function swimMaterial(src) {
  const m = src.clone();
  m.roughness = 0.45; m.metalness = 0;
  m.userData.uPhase = { value: Math.random() * 6.28 }; m.userData.uBeat = { value: 6 };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uTime: U.uTime, uPhase: m.userData.uPhase, uBeat: m.userData.uBeat });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uPhase; uniform float uBeat;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        // head at -x, tail at +x (model units, length 1): the wave grows towards the tail
        float tailw = smoothstep(-0.3, 0.5, position.x);
        transformed.z += sin(position.x * 7.0 - uTime * uBeat + uPhase) * 0.06 * tailw;`);
  };
  return m;
}
function loadSwimmers() {
  SWIMMERS.forEach((sp) => gltf.load(scanURL(sp.file), (res) => { if (!disposed) swimTemplates[sp.file] = res.scene; }));
}
loadRocks().then(startReef);
setTimeout(startReef, 3000);
const visitors = [];
let nextVisit = 8 + Math.random() * 6;
function spawnVisitors() {
  const ready = SWIMMERS.filter((sp) => swimTemplates[sp.file]);
  if (!ready.length || visitors.length) return;
  const sp = ready[Math.floor(Math.random() * ready.length)];
  const dir = Math.random() < 0.5 ? 1 : -1, n = sp.count[0] + Math.floor(Math.random() * (sp.count[1] - sp.count[0] + 1));
  const y = 0.3 + Math.random() * 0.45, z = -1.3 + Math.random() * 1.6;
  for (let i = 0; i < n; i++) {
    const f = new THREE.Group(), body = swimTemplates[sp.file].clone(true);
    body.traverse((o) => { if (o.isMesh) { o.material = swimMaterial(o.material); o.material.userData.uBeat.value = sp.beat * (0.9 + Math.random() * 0.2); o.castShadow = true; } });
    body.rotation.y = Math.PI;            // head towards +x, the direction of travel before the turn below
    f.add(body);
    f.scale.setScalar(sp.size * (0.9 + Math.random() * 0.2));
    f.userData = { dir, speed: sp.speed * (0.9 + Math.random() * 0.2), phase: Math.random() * 6 };
    f.position.set(-dir * (3.8 + i * 0.35), y + (Math.random() - 0.5) * 0.25, z + (Math.random() - 0.5) * 0.4);
    f.rotation.y = dir > 0 ? 0 : Math.PI;
    scene.add(f); visitors.push(f);
  }
}
function updateVisitors(dt, t) {
  for (let i = visitors.length - 1; i >= 0; i--) {
    const f = visitors[i], u = f.userData;
    f.position.x += u.dir * u.speed * dt;
    f.position.y += Math.sin(t * 0.9 + u.phase) * 0.0008;
    f.rotation.y = (u.dir > 0 ? 0 : Math.PI) + Math.sin(t * 0.6 + u.phase) * 0.08;
    if (Math.abs(f.position.x) > 4.5) {
      scene.remove(f);
      f.traverse((o) => { if (o.isMesh) o.material.dispose(); });
      visitors.splice(i, 1);
    }
  }
}


// ── Marine snow: slow particles in the water ───────────────────
const snowGeo = new THREE.BufferGeometry();
const sp = []; const SR = rng(99);
for (let i = 0; i < 260; i++) sp.push((SR() - 0.5) * 3.4, SR() * 2.2, (SR() - 0.5) * 3.4);
snowGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
const snow = new THREE.Points(snowGeo, new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, uniforms: { uTime: U.uTime, uSize: { value: 5 * renderer.getPixelRatio() } },
  vertexShader: `uniform float uTime; uniform float uSize; void main(){ vec3 p = position; p.y = mod(p.y - uTime * 0.03, 2.2); p.x += sin(uTime * 0.3 + position.z * 3.0) * 0.05; vec4 mv = modelViewMatrix * vec4(p,1.0); gl_PointSize = uSize / -mv.z; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(0.75, 0.93, 0.98, 0.4 * smoothstep(0.5, 0.2, d)); }`,
}));
scene.add(snow);

// ── Backdrop: the open water behind the reef, with a shimmering surface and light rays from the sun ──
const backdropU = { uRes: { value: new THREE.Vector2(1, 1) } };
const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  depthWrite: false, depthTest: false, fog: false,
  uniforms: { ...backdropU, uTime: U.uTime, uCaustic: U.uCaustic },
  vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.9999, 1.0); }',
  fragmentShader: `uniform vec2 uRes; uniform float uTime; uniform float uCaustic;
    ${WATER_GLSL}
    float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
    void main(){
      vec2 uv = gl_FragCoord.xy / uRes;
      vec3 c = rpWater(uv);
      float t = 1.0 - uv.y;
      // The surface seen from below: bright ripples, stretched by perspective towards the top edge
      float band = 1.0 - smoothstep(0.0, 0.24, t);
      vec2 p = vec2((uv.x - 0.55) / (t + 0.15) * 2.6, 1.4 / (t + 0.15));
      float w = n2(p + vec2(uTime * 0.12, uTime * 0.05)) * 0.6 + n2(p * 2.2 - vec2(uTime * 0.09, 0.0)) * 0.4;
      float ridge = pow(1.0 - abs(w * 2.0 - 1.0), 5.0);
      c += uCaustic * band * band * ridge * vec3(0.55, 0.85, 1.0) * 0.85;
      // Rays fanning down from the sun glow
      vec2 d = (vec2(uv.x, t) - vec2(0.62, -0.1)) * vec2(uRes.x / uRes.y, 1.0);
      float ang = atan(d.x, d.y);
      float r = n2(vec2(ang * 9.0, uTime * 0.06)) * 0.65 + n2(vec2(ang * 23.0 + 3.0, uTime * 0.1)) * 0.35;
      c += uCaustic * smoothstep(0.5, 1.0, r) * exp(-length(d) * 1.5) * smoothstep(1.0, 0.1, t) * vec3(0.45, 0.8, 1.0) * 0.45;
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
}));
backdrop.frustumCulled = false; backdrop.renderOrder = -1000;
scene.add(backdrop);

// ── Light shafts: soft beams leaning towards the sun, in front of and behind the colony ──
const sunDir = sun.position.clone().normalize();
const shaftMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  uniforms: { uTime: U.uTime, uCaustic: U.uCaustic },
  vertexShader: `attribute float aSeed; varying vec2 vUv; varying float vDist; varying float vSeed;
    void main(){ vUv = uv; vSeed = aSeed; vec4 mv = modelViewMatrix * vec4(position, 1.0); vDist = -mv.z; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform float uTime; uniform float uCaustic; varying vec2 vUv; varying float vDist; varying float vSeed;
    void main(){
      float edge = smoothstep(0.0, 0.5, vUv.x) * smoothstep(1.0, 0.5, vUv.x);
      float rise = smoothstep(0.0, 0.7, vUv.y) * (1.0 - smoothstep(0.85, 1.0, vUv.y) * 0.5);
      float flick = 0.6 + 0.4 * sin(uTime * 0.5 + vSeed * 6.28 + vUv.y * 2.5);
      float a = edge * edge * rise * flick * smoothstep(0.8, 2.0, vDist) * exp(-max(vDist - 4.0, 0.0) * 0.35);
      gl_FragColor = vec4(vec3(0.5, 0.82, 1.0) * a * 0.09 * uCaustic, 1.0);
      #include <colorspace_fragment>
    }`,
});
const SHAFTS = [[-0.9, -0.7, 0.45], [0.55, -1.7, 0.6], [1.9, -1.0, 0.35], [2.9, -2.3, 0.7], [-0.35, 1.15, 0.28], [1.25, 0.55, 0.22], [-1.9, -2.4, 0.8]];
const shafts = SHAFTS.map(([x, z, w], i) => {
  const g = new THREE.PlaneGeometry(1, 1); g.translate(0, 0.5, 0);
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(new Array(4).fill(i / SHAFTS.length), 1));
  const m = new THREE.Mesh(g, shaftMat);
  m.scale.set(w, 5.5, 1); m.position.set(x, seabed(x, z) - 0.05, z); m.renderOrder = 10;
  scene.add(m);
  return m;
});
const shaftBasis = new THREE.Matrix4(), toCam = new THREE.Vector3(), side = new THREE.Vector3();
function faceShafts() {
  // Each beam turns around its own (sun-leaning) axis to face the camera
  for (const s of shafts) {
    toCam.copy(camera.position).sub(s.position);
    toCam.addScaledVector(sunDir, -toCam.dot(sunDir)).normalize();
    side.crossVectors(sunDir, toCam).normalize();
    shaftBasis.makeBasis(side, sunDir, toCam);
    s.quaternion.setFromRotationMatrix(shaftBasis);
  }
}

// ── Environment: the water lights and tints every surface (reflections, soft fill from all sides) ──
const envScene = new THREE.Scene();
const envMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  uniforms: {
    uUp: { value: new THREE.Color(cssVar('--sun') || '#73E9FB') },
    uHor: { value: new THREE.Color(cssVar('--surface') || '#2C6FD6') },
    uDown: { value: new THREE.Color(cssVar('--sand') || '#8FA3B5') },
    uSunDir: { value: sunDir }, uGain: { value: 0.35 }, uSun: { value: 1.6 },
  },
  vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform vec3 uUp; uniform vec3 uHor; uniform vec3 uDown; uniform vec3 uSunDir; uniform float uGain; uniform float uSun; varying vec3 vDir;
    void main(){
      vec3 d = normalize(vDir);
      vec3 c = d.y > 0.0 ? mix(uHor * 0.7, uUp, pow(d.y, 0.7)) : mix(uHor * 0.7, uDown * 0.3, pow(-d.y, 0.5));
      float s = max(dot(d, uSunDir), 0.0);
      c += vec3(1.0, 0.97, 0.9) * uSun * (pow(s, 32.0) + pow(s, 4.0) * 0.1);
      gl_FragColor = vec4(c * uGain, 1.0);
    }`,
});
envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), envMat));
let envRT = null;
function makeEnv(gain = envMat.uniforms.uGain.value, sunGain = envMat.uniforms.uSun.value) {
  envMat.uniforms.uGain.value = gain; envMat.uniforms.uSun.value = sunGain;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const next = pmrem.fromScene(envScene, 0.02);
  pmrem.dispose();
  scene.environment = next.texture;
  if (envRT) envRT.dispose();
  envRT = next;
}
makeEnv();

// ── Post-processing: ambient occlusion, depth of field, bloom, tone mapping and colour grade ──
// Replaces any invalid pixel (NaN / infinity) before the blurs, which would otherwise spread it into blotches,
// and keeps the image opaque.
class SanitizeEffect extends Effect {
  constructor() {
    super('SanitizeEffect', `void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
      vec3 c = inputColor.rgb;
      if (any(isnan(c)) || any(isinf(c)) || c.r != c.r || c.g != c.g || c.b != c.b) c = vec3(0.0);
      outputColor = vec4(clamp(c, 0.0, 64.0), 1.0);
    }`);
  }
}
// Last step: the canvas is transparent for the globe's starfield, so the reef image must leave fully opaque
// (bloom otherwise writes its own alpha and the page shows through in patches).
class OpaqueEffect extends Effect {
  constructor() {
    super('OpaqueEffect', 'void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) { outputColor = vec4(inputColor.rgb, 1.0); }',
      { blendFunction: BlendFunction.SRC });
  }
}
let composer = null;
const fx = {};
function buildComposer() {
  if (composer) { composer.dispose(); composer = null; }
  Object.keys(fx).forEach((k) => delete fx[k]);
  renderer.setPixelRatio(pixelRatioFor(tier));
  if (tier === 'off') return;
  try {
    const w = stage.clientWidth || 1, h = stage.clientHeight || 1;
    composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: tier === 'high' ? 2 : 0 });
    composer.addPass(new RenderPass(scene, camera));
    fx.ao = new N8AOPostPass(scene, camera, w, h);
    Object.assign(fx.ao.configuration, {
      aoRadius: 0.22, distanceFalloff: 0.6, intensity: 2.6, aoSamples: tier === 'high' ? 12 : 8,
      denoiseSamples: tier === 'high' ? 6 : 4, denoiseRadius: 10, halfRes: true,
      color: new THREE.Color(cssVar('--abyss') || '#08193D'), gammaCorrection: false,
    });
    composer.addPass(fx.ao);
    composer.addPass(new EffectPass(camera, new SanitizeEffect()));
    if (tier === 'high') {
      fx.dof = new DepthOfFieldEffect(camera, { worldFocusDistance: 3.6, worldFocusRange: 2.4, bokehScale: 2.2, resolutionScale: 0.5 });
      fx.dof.target = controls.target;   // keep the colony (or the close-up tip) sharp
      composer.addPass(new EffectPass(camera, fx.dof));
    }
    fx.bloom = new BloomEffect({ mipmapBlur: true, intensity: 0.45, luminanceThreshold: 0.92, luminanceSmoothing: 0.15, radius: 0.65 });
    fx.tone = new ToneMappingEffect({ mode: params.get('tm') === 'agx' ? ToneMappingMode.AGX : ToneMappingMode.ACES_FILMIC });
    fx.sat = new HueSaturationEffect({ saturation: 0.28 });
    fx.contrast = new BrightnessContrastEffect({ brightness: 0.02, contrast: 0.18 });
    fx.vignette = new VignetteEffect({ offset: 0.32, darkness: 0.55 });
    composer.addPass(new EffectPass(camera, fx.bloom, fx.tone, fx.sat, fx.contrast, fx.vignette, new OpaqueEffect()));
    composer.setSize(w, h, false);
  } catch (err) {
    console.warn('Reef Pulse: post-processing unavailable, using the plain render.', err);
    if (composer) composer.dispose();
    composer = null; tier = 'off'; renderer.setPixelRatio(pixelRatioFor(tier));
  }
}
buildComposer();

// Watch the frame time and drop a quality level if the scene can't keep up (unless forced by ?quality).
// Very long frames (a hidden or throttled window) don't count.
let slowFrames = 0, sampled = 0, fpsFrames = 0, fpsT = 0, fps = 0;
function watchFrame(dt) {
  fpsFrames += 1; fpsT += dt; if (fpsT >= 1) { fps = Math.round(fpsFrames / fpsT); fpsFrames = 0; fpsT = 0; }
  if (forced || tier === 'off' || document.hidden || dt > 0.2) return;
  sampled += 1; if (dt > 1 / 30) slowFrames += 1;
  if (sampled < 240) return;
  if (slowFrames > 170) { tier = tier === 'high' ? 'low' : 'off'; buildComposer(); resize(); }
  sampled = 0; slowFrames = 0;
}


let levelTarget = 26 / 60;
const FORMS = ['bush', 'brain', 'table', 'boulder', 'tall'];
let formIndex = 0;
function newColony() {
  seed += 1; formIndex = (formIndex + 1) % FORMS.length;
  buildAny(seed, group, { shape: FORMS[formIndex], detail: true, mute: 0 });
  flying = 1; // re-frame the close-up target if it is on
}
let closeUp = false, flying = 0;
const camHome = new THREE.Vector3(0.35, 1.45, 3.5), tgtHome = new THREE.Vector3(0, 0.32, 0);
function setCloseUp(on) {
  closeUp = on; flying = 1;
  controls.autoRotate = !closeUp && !reduceMotion;
}
function setWater(on) { U.uCaustic.value = on ? 1 : 0; snow.visible = on; }
controls.addEventListener('start', () => { flying = 0; });


// ── Globe: picking a reef is a journey. The camera rises out of the reef, a globe appears,
//    and choosing a reef dives back down into it. ─────────────────────────────────────────
const globeScene = new THREE.Scene();
const gCam = new THREE.PerspectiveCamera(32, 1, 0.01, 50);
const gControls = new OrbitControls(gCam, canvas);
gControls.enabled = false; gControls.enablePan = false; gControls.enableDamping = true;
gControls.minDistance = 2.4; gControls.maxDistance = 7;
gControls.autoRotate = !reduceMotion; gControls.autoRotateSpeed = 0.35;
let resumeSpin = null;
gControls.addEventListener('start', () => { gControls.autoRotate = false; clearTimeout(resumeSpin); });
gControls.addEventListener('end', () => { resumeSpin = setTimeout(() => { gControls.autoRotate = !reduceMotion; }, 4000); }); gControls.rotateSpeed = 0.5;
globeScene.add(new THREE.HemisphereLight(0xcdf6ff, 0x0e2e66, 0.9));
const gSun = new THREE.DirectionalLight(0xffffff, 2.2); globeScene.add(gSun); gCam.add(gSun); gSun.position.set(2.5, 2, 3); globeScene.add(gCam);

const latLon = (lat, lon, r = 1) => {
  const th = (90 - lat) * Math.PI / 180, u = (lon + 180) / 360 * Math.PI * 2;
  return new THREE.Vector3(-Math.cos(u) * Math.sin(th) * r, Math.cos(th) * r, Math.sin(u) * Math.sin(th) * r);
};
// Real satellite imagery: NASA Blue Marble (public domain), with a relief map for the mountains
// and a water mask so the oceans catch the sun.
const texLoader = new THREE.TextureLoader();
const loadTex = (src, srgb) => { const t = texLoader.load(src); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t; };
const globe = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), new THREE.MeshPhongMaterial({
  map: loadTex(assets + '/earth-day.jpg', true), bumpMap: loadTex(assets + '/earth-bump.jpg'), bumpScale: 0.6,
  specularMap: loadTex(assets + '/earth-water.jpg'), specular: new THREE.Color('#3a5f86'), shininess: 22,
}));
globeScene.add(globe);
// The 15–20° belts, drawn as thin orange rings just above the surface (crisp at any zoom)
for (const lat of [17.5, -17.5]) {
  const pts = [];
  for (let k = 0; k <= 256; k++) pts.push(latLon(lat, -180 + k / 256 * 360, 1.003));
  globeScene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xff8a4c, transparent: true, opacity: 0.85 })));
}
// atmosphere: a soft cyan rim
globeScene.add(new THREE.Mesh(new THREE.SphereGeometry(1.03, 96, 64), new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
  vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'varying vec3 vN; void main(){ float r = pow(1.0 - abs(vN.z), 5.0); gl_FragColor = vec4(0.42, 0.8, 1.0, r * 0.75); }',
})));

const reefPins = new THREE.InstancedMesh(new THREE.SphereGeometry(0.015, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), REEFS.length);
globeScene.add(reefPins);
const pinM = new THREE.Matrix4();
REEFS.forEach((r, i) => { pinM.makeTranslation(latLon(r.lat, r.lon, 1.012)); reefPins.setMatrixAt(i, pinM); });
const selRing = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.006, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffffff }));
globeScene.add(selRing);
const hoverRing = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.004, 8, 32), new THREE.MeshBasicMaterial({ color: 0xff8a4c }));
hoverRing.visible = false; globeScene.add(hoverRing);
const placeRing = (ring, i) => { const p = latLon(REEFS[i].lat, REEFS[i].lon, 1.014); ring.position.copy(p); ring.lookAt(p.clone().multiplyScalar(2)); };
// Risk scale for the globe: pale blue (low) → yellow → orange → red (very high), same thresholds as the risk levels
// Under any one heatwave the reefs span a narrow band of risk (e.g. 8–33%), so an absolute scale paints
// them all orange. The dots are coloured relative to that band instead: which reefs are most and least
// vulnerable right now. The legend shows the real percentages at both ends.
const PIN_STOPS = ['#BFE6FA', '#7FD3E8', '#FFE08A', '#FF9A4A', '#E8452A'];
function rampColour(t) {
  t = Math.max(0, Math.min(1, t)) * (PIN_STOPS.length - 1);
  const i = Math.min(PIN_STOPS.length - 2, Math.floor(t));
  return new THREE.Color(PIN_STOPS[i]).lerp(new THREE.Color(PIN_STOPS[i + 1]), t - i);
}
function riskBand() {
  const S = getState(), dhw = S.heat >= 1 ? S.heat * S.weeks : 0;
  const v = REEFS.map((r) => riskOf(dhw, r.sd, r.lat) * 100);
  return { v, lo: Math.min(...v), hi: Math.max(...v) };
}
function colourPins() {
  const c = new THREE.Color();
  const { v, lo, hi } = riskBand();
  REEFS.forEach((r, i) => { c.copy(rampColour((v[i] - lo) / Math.max(1, hi - lo))); reefPins.setColorAt(i, c); });
  reefPins.instanceColor.needsUpdate = true;
  placeRing(selRing, getState().reef);
}

// Fade veil between the two scenes, and a hint while the globe is up
const gLabel = (cls) => { const el = document.createElement('div'); el.className = 'pinlabel ' + cls; el.hidden = true; stage.appendChild(el); return el; };
const selLabel = gLabel('pinlabel--sel'), hovLabel = gLabel('pinlabel--hover');
function placeLabel(el, i) {
  if (i < 0) { el.hidden = true; return; }
  const p = latLon(REEFS[i].lat, REEFS[i].lon, 1.012);
  const facing = p.clone().normalize().dot(gCam.position.clone().normalize()) > 0.15;
  if (!facing) { el.hidden = true; return; }
  const v = p.project(gCam), r = canvas.getBoundingClientRect();
  el.textContent = REEFS[i].n;
  el.style.left = ((v.x + 1) / 2 * r.width) + 'px'; el.style.top = ((1 - v.y) / 2 * r.height) + 'px';
  el.hidden = false;
}
const space = document.createElement('div'); space.className = 'space'; space.setAttribute('aria-hidden', 'true');
stage.parentElement.insertBefore(space, stage);
const fade = document.createElement('div');
fade.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .45s ease;background:var(--fog)';
stage.appendChild(fade);
const gHint = document.createElement('div');
gHint.className = 'globehint'; gHint.hidden = true; gHint.setAttribute('role', 'status');
stage.parentElement.appendChild(gHint);
const fadeTo = (v) => new Promise((res) => { fade.style.opacity = String(v); setTimeout(res, reduceMotion ? 0 : 460); });
const tweenCam = (cam, ctl, toPos, toTgt, ms) => new Promise((res) => {
  const p0 = cam.position.clone(), t0 = ctl.target.clone(), start = performance.now();
  const step = () => {
    const k = reduceMotion ? 1 : Math.min(1, (performance.now() - start) / ms), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    cam.position.lerpVectors(p0, toPos, e); ctl.target.lerpVectors(t0, toTgt, e); cam.lookAt(ctl.target);
    if (k < 1) requestAnimationFrame(step); else res();
  };
  step();
});
let mode = 'reef', busy = false, grow = 1;
function hintGlobe(text) {
  const { lo, hi } = riskBand();
  gHint.innerHTML = `<span class="legend"><b>${Math.round(lo)}%</b><i></i><b>${Math.round(hi)}%</b> ${T().riskBand}</span><span></span>`;
  gHint.lastChild.textContent = text; gHint.hidden = false;
}

async function enterGlobe() {
  if (busy || mode === 'globe') return; busy = true;
  flying = 0; controls.autoRotate = false;
  const up = camera.position.clone().add(new THREE.Vector3(0, 2.6, 0.8));
  fadeTo(1);
  await tweenCam(camera, controls, up, tgtHome.clone().add(new THREE.Vector3(0, 1.2, 0)), 700);
  mode = 'globe'; controls.enabled = false; gControls.enabled = true; onGlobe(true);
  colourPins();
  const r = REEFS[getState().reef], dir = latLon(r.lat + 12, r.lon).normalize();
  gCam.position.copy(dir.clone().multiplyScalar(6.5)); gControls.target.set(0, 0, 0); gControls.update();
  hintGlobe(T().globeHint);
  fadeTo(0);
  await tweenCam(gCam, gControls, dir.clone().multiplyScalar(4.6), new THREE.Vector3(), 900);
  busy = false;
}
async function leaveGlobe(pick) {
  if (busy || mode !== 'globe') return; busy = true;
  gHint.hidden = true; hoverRing.visible = false; selLabel.hidden = true; hovLabel.hidden = true; hoverI = -1;
  const target = pick ?? getState().reef, r = REEFS[target];
  const dir = latLon(r.lat, r.lon).normalize();
  if (pick != null) { onPick(pick); placeRing(selRing, pick); }
  // turn to the reef, then dive towards it
  await tweenCam(gCam, gControls, dir.clone().multiplyScalar(4.2), new THREE.Vector3(), 650);
  fadeTo(1);
  await tweenCam(gCam, gControls, dir.clone().multiplyScalar(1.25), new THREE.Vector3(), 600);
  mode = 'reef'; gControls.enabled = false; controls.enabled = true; onGlobe(false);
  if (pick != null) {
    seed += 1;
    buildAny(seed, group, { shape: FORMS[formIndex], detail: true, mute: 0 });
    grow = 0;
  }
  camera.position.copy(camHome.clone().add(new THREE.Vector3(0, 2.2, 0.6)));
  controls.target.copy(tgtHome.clone().add(new THREE.Vector3(0, 0.8, 0)));
  fadeTo(0);
  closeUp = false; onCloseUp(false);
  await tweenCam(camera, controls, camHome, tgtHome, 1100);
  controls.autoRotate = !reduceMotion;
  busy = false;
  onReturn();
}

// Globe picking: hover names a reef, a click (not a drag) chooses it
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let downAt = null, hoverI = -1;
function pickAt(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, gCam);
  const hit = ray.intersectObjects([globe, reefPins], false)[0];
  if (!hit || hit.object !== reefPins) {
    // be generous: nearest pin to the ray within a small angle
    let best = -1, bd = 0.045;
    REEFS.forEach((rr, i) => { const p = latLon(rr.lat, rr.lon, 1.012); if (p.clone().sub(gCam.position).dot(gCam.position) > 0) return; const d = ray.ray.distanceToPoint(p); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  return hit.instanceId;
}
canvas.addEventListener('pointerdown', (e) => { if (mode === 'globe') downAt = [e.clientX, e.clientY]; });
canvas.addEventListener('pointermove', (e) => {
  if (mode !== 'globe' || busy) return;
  const i = pickAt(e);
  if (i !== hoverI) {
    hoverI = i; canvas.style.cursor = i >= 0 ? 'pointer' : 'grab';
    if (i >= 0) { placeRing(hoverRing, i); hoverRing.visible = true; hintGlobe(T().globePin(REEFS[i])); }
    else { hoverRing.visible = false; hintGlobe(T().globeHint); }
  }
});
canvas.addEventListener('pointerup', (e) => {
  if (mode !== 'globe' || !downAt) return;
  const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]); downAt = null;
  if (moved < 5) { const i = pickAt(e); if (i >= 0) leaveGlobe(i); }
});


// Resize: on wide screens the colony sits right of centre, so the sentence has room
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  gCam.aspect = w / h;
  for (const c of [camera, gCam]) {
    if (w > 820) c.setViewOffset(w, h, -w * 0.25, h * 0.02, w, h); else c.clearViewOffset();
    c.updateProjectionMatrix();
  }
  // Backdrop and fog look up the water colour by pixel, so they need the drawing-buffer size
  const pr = renderer.getPixelRatio();
  backdropU.uRes.value.set(Math.max(1, Math.floor(w * pr)), Math.max(1, Math.floor(h * pr)));
  scene.fog.near = backdropU.uRes.value.y; scene.fog.far = backdropU.uRes.value.x;
  if (composer) composer.setSize(w, h, false);
}
const ro = new ResizeObserver(resize); ro.observe(stage);
resize();

const clock = new THREE.Clock();
const camGoal = new THREE.Vector3(), tgtGoal = new THREE.Vector3();
renderer.setAnimationLoop(() => {
  const raw = clock.getDelta(), dt = Math.min(raw, 0.05);
  if (!reduceMotion) {
    U.uTime.value += dt;
    nextVisit -= dt;
    if (nextVisit <= 0) { spawnVisitors(); nextVisit = 14 + Math.random() * 16; }
    updateVisitors(dt, U.uTime.value);
  }
  U.uLevel.value += (levelTarget - U.uLevel.value) * (reduceMotion ? 1 : Math.min(1, dt * 3));
  if (flying > 0) {
    if (closeUp) { tgtGoal.copy(focusTip); camGoal.copy(focusTip).add(new THREE.Vector3(0.12, 0.08, 0.42)); }
    else { tgtGoal.copy(tgtHome); camGoal.copy(camHome); }
    const k = reduceMotion ? 1 : Math.min(1, dt * 2.5);
    controls.target.lerp(tgtGoal, k); camera.position.lerp(camGoal, k);
    if (camera.position.distanceTo(camGoal) < 0.005) flying = 0;
  }
  if (grow < 1) { grow = Math.min(1, grow + dt * (reduceMotion ? 99 : 0.9)); const e = 1 - Math.pow(1 - grow, 3); group.scale.setScalar(0.35 + 0.65 * e); }
  if (mode === 'globe') {
    if (!busy) gControls.update();
    placeLabel(selLabel, busy ? -1 : getState().reef);
    placeLabel(hovLabel, !busy && hoverI !== getState().reef ? hoverI : -1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setClearAlpha(0);                      // the starfield behind the globe is a page layer
    renderer.render(globeScene, gCam);
  } else {
    if (!busy) controls.update();
    faceShafts();
    if (composer) {
      renderer.toneMapping = THREE.NoToneMapping;   // tone mapping happens in the last effect pass
      renderer.setClearAlpha(1);                    // effects carry alpha through: keep the image opaque
      composer.render(dt);
    } else {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.render(scene, camera);
    }
    watchFrame(raw);
  }
});
// ── API used by React ──
let disposed = false;
return {
  setLevel(level) { levelTarget = Math.max(0, Math.min(1, level)); },
  setDim(dim) { canvas.style.opacity = dim ? '0.35' : '1'; },
  newColony,
  setCloseUp,
  setWater,
  enterGlobe,
  leaveGlobe,
  inGlobe: () => mode === 'globe',
  refreshPins() { if (mode === 'globe') { colourPins(); hintGlobe(T().globeHint); } },
  // Tuning handle, only with ?debug in the URL
  debug: (params.has('debug') || process.env.REACT_APP_RP_TUNE) ? { fx, hemi, sun, makeEnv, backdrop, shaftMat, scene, renderer, U, get tier() { return tier; }, get fps() { return fps; }, get composer() { return composer; }, setLevel(v) { levelTarget = v; }, camera, controls, spawnVisitors, get fishInfo() { return { templates: Object.keys(swimTemplates), visitors: visitors.map((f) => [f.position.x, f.position.y, f.position.z].map((v) => +v.toFixed(2))) }; }, peekFish() { visitors.forEach((f, i) => { f.position.set(1.3 + i * 0.35, 0.6, 0.6); f.userData.speed = 0.01; }); }, setTier(q) { tier = q; buildComposer(); resize(); } } : null,
  dispose() {
    if (disposed) return; disposed = true;
    renderer.setAnimationLoop(null); ro.disconnect();
    controls.dispose(); gControls.dispose();
    if (composer) composer.dispose(); if (envRT) envRT.dispose();
    [space, fade, gHint, selLabel, hovLabel].forEach((el) => el.remove());
    scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    renderer.dispose();
  },
};
}
