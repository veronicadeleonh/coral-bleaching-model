// Reef Pulse 3D scene: the coral specimen on its reef, fish, water light, and the globe used to pick a reef.
// Plain three.js driven from React (components/ReefScene.jsx) through the small API returned at the end.
/* eslint-disable no-use-before-define */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export function createEngine({ canvas, stage, reefs, riskOf, getState, onPick, onGlobe, onCloseUp, onReturn, text, assets }) {
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Reefs in the short shape the scene uses
const REEFS = reefs.map((r) => ({ n: r.name, lat: r.lat, lon: r.lon, sd: r.ssta_sd, o: r.ocean, c: r.n }));
const T = () => text();


const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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

scene.add(new THREE.HemisphereLight(0xbdf3fb, 0x0e2e66, 1.7));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
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
const sandMat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, transparent: true, depthWrite: false });
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


scene.fog = new THREE.Fog(cssVar('--fog') || '#17438C', 4.6, 9.5);
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
function coralMaterial(mute = 0, soft = 0.15) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U, { uBone: { value: BONE }, uMute: { value: mute }, uWater: WATER, uSoft: { value: soft } });
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
        uniform float uLevel; uniform float uTime; uniform float uCaustic; uniform vec3 uBone; uniform float uMute; uniform vec3 uWater; uniform float uSoft;
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
        float bl = smoothstep(vKey * (1.0 - uSoft), vKey * (1.0 - uSoft) + uSoft, uLevel);
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
const DECOR_MUTE = 0.18;
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

// Live rock: lumpy, porous, mottled with coralline algae (pink, purple), green turf and brown film
const liveRockMat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
liveRockMat.onBeforeCompile = (sh) => {
  Object.assign(sh.uniforms, { uMute: { value: 0.08 }, uWater: WATER });
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vP;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvP = position;');
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
function liveRock(seed, r) {
  const g = new THREE.IcosahedronGeometry(1, 5);
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
  const g = new THREE.IcosahedronGeometry(1, 4);
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
  () => { const g = new THREE.Group(); buildMassive(51, g, { shape: 'brain', detail: false, mute: 0.5 }); g.scale.setScalar(0.75); place(g, -1.0, -1.15, 0.02); },
  () => { const g = new THREE.Group(); buildMassive(52, g, { shape: 'boulder', detail: false, mute: 0.5 }); g.scale.setScalar(0.7); place(g, 2.65, 0.2, 0.02); },
  () => { const g = new THREE.Group(); buildMassive(53, g, { shape: 'brain', detail: false, mute: 0.55 }); g.scale.setScalar(0.55); place(g, 2.1, -1.15, 0.02); },
];
// Branching colonies of the same kind as the specimen: they bleach with it, muted
const BACK = [
  { shape: 'table', x: 1.55, z: -0.45, s: 0.55 }, { shape: 'bush', x: 0.45, z: -1.3, s: 0.45 },
  { shape: 'tall', x: -0.15, z: -2.25, s: 0.42 }, { shape: 'table', x: 1.85, z: -2.25, s: 0.62 },
];
[...REEF, ...BACK.map((c, i) => () => {
  const g = new THREE.Group();
  build(40 + i * 7, g, { shape: c.shape, detail: false, mute: 0.5 });
  g.scale.setScalar(c.s);
  place(g, c.x, c.z, 0.02, i * 1.7);
})].forEach((fn, i) => setTimeout(fn, 250 + i * 60));

// ── Fish: now and then a small school of anthias crosses the reef ──
// Shared fish parts (head points to +x; ~0.12 long). Body: tapered profile with a pointed snout
// and a narrow tail stem, orange back fading to a golden belly.
const L = 0.12;
const fishBodyGeo = (() => {
  const g = new THREE.SphereGeometry(1, 28, 16);
  const pos = g.attributes.position, col = [], back = new THREE.Color('#F2762E'), belly = new THREE.Color('#F7B63C'), v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const t = (v.x + 1) / 2;                                   // 0 tail stem … 1 snout
    // rounded head (an ellipse arc), body tapering to a narrow tail stem
    const prof = t >= 0.55 ? Math.sqrt(Math.max(0.0, 1 - ((t - 0.55) / 0.47) ** 2))
      : 0.2 + 0.8 * Math.pow(Math.sin((Math.PI / 2) * (t / 0.55)), 1.3);
    const snout = 1;
    const hy = 0.1 * prof * snout * (v.y < 0 ? 1.12 : 1);      // a little deeper below
    const hz = 0.04 * prof * snout;
    pos.setXYZ(i, v.x * L / 2, v.y * hy * L / 0.5, v.z * hz * L / 0.5);
    const c = back.clone().lerp(belly, Math.min(1, Math.max(0, 0.5 - v.y * 0.9))).lerp(belly, (1 - t) * 0.35);
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
})();
const fishMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.08 });
const finMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#F8C24A'), roughness: 0.6, metalness: 0, side: THREE.DoubleSide, transparent: true, opacity: 0.82 });
const eyeMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#0B0B10'), roughness: 0.2, metalness: 0.3 });
const irisMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#E8D27A'), roughness: 0.4, metalness: 0.2 });
const shapeGeo = (pts, curve) => {
  const sh = new THREE.Shape();
  sh.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const [x, y, cx, cy] = pts[i];
    if (cx !== undefined) sh.quadraticCurveTo(cx, cy, x, y); else sh.lineTo(x, y);
  }
  return new THREE.ShapeGeometry(sh, 12);
};
// Tail: lunate (crescent) fin with a curved, concave trailing edge
const fishTailGeo = shapeGeo([[0, 0.006], [-0.042, 0.034, -0.018, 0.026], [-0.03, 0, -0.022, 0.012], [-0.042, -0.034, -0.022, -0.012], [0, -0.006, -0.018, -0.026], [0, 0.006]]);
// Dorsal fin: tall front, sloping back, rounded edge
const dorsalGeo = shapeGeo([[0.02, 0], [0.002, 0.028, 0.016, 0.026], [-0.034, 0.006, -0.02, 0.024], [-0.03, 0], [0.02, 0]]);
// Anal fin underneath, and a small pelvic fin
const analGeo = shapeGeo([[0.0, 0], [-0.012, -0.018, 0.0, -0.016], [-0.03, -0.004, -0.024, -0.016], [-0.026, 0], [0, 0]]);
const pelvicGeo = shapeGeo([[0.012, 0], [0.0, -0.014, 0.01, -0.012], [-0.006, 0], [0.012, 0]]);
const pecGeo = shapeGeo([[0, 0], [-0.016, 0.008, -0.006, 0.01], [-0.018, -0.004, -0.02, 0.003], [0, 0]]);
const eyeGeo = new THREE.SphereGeometry(0.0028, 10, 8), irisGeo = new THREE.SphereGeometry(0.0042, 12, 8);
const school = [];
function makeFish() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(fishBodyGeo, fishMat); body.castShadow = true;
  const tail = new THREE.Group(); tail.position.x = -L / 2 + 0.004;
  tail.add(new THREE.Mesh(fishTailGeo, finMat));
  const dorsal = new THREE.Mesh(dorsalGeo, finMat); dorsal.position.set(0.0, 0.019, 0); dorsal.scale.set(0.85, 0.75, 1);
  const anal = new THREE.Mesh(analGeo, finMat); anal.position.set(-0.008, -0.018, 0); anal.scale.set(0.9, 0.8, 1);
  const pelvic = new THREE.Mesh(pelvicGeo, finMat); pelvic.position.set(0.016, -0.022, 0);
  const pecL = new THREE.Mesh(pecGeo, finMat); pecL.position.set(0.022, -0.004, 0.009); pecL.rotation.y = -0.5;
  const pecR = new THREE.Mesh(pecGeo, finMat); pecR.position.set(0.022, -0.004, -0.009); pecR.rotation.y = 0.5;
  g.add(body, tail, dorsal, anal, pelvic, pecL, pecR);
  for (const side of [1, -1]) {
    const iris = new THREE.Mesh(irisGeo, irisMat); iris.position.set(0.036, 0.005, side * 0.0046); iris.scale.z = 0.5;
    const eye = new THREE.Mesh(eyeGeo, eyeMat); eye.position.set(0.0362, 0.005, side * 0.0062); eye.scale.z = 0.5;
    g.add(iris, eye);
  }
  g.userData.tail = tail; g.userData.pecs = [pecL, pecR]; g.userData.body = body;
  return g;
}
function spawnSchool() {
  if (school.length) return;
  const dir = Math.random() < 0.5 ? 1 : -1;
  const n = 3 + Math.floor(Math.random() * 5);
  const y = 0.55 + Math.random() * 0.9, z = -1.4 + Math.random() * 1.9;
  const speed = 0.32 + Math.random() * 0.18;
  for (let i = 0; i < n; i++) {
    const f = makeFish();
    f.userData = { ...f.userData, dir, speed: speed * (0.9 + Math.random() * 0.2), phase: Math.random() * 6,
      off: new THREE.Vector3(-dir * (i * 0.12 + Math.random() * 0.08), (Math.random() - 0.5) * 0.22, (Math.random() - 0.5) * 0.35) };
    f.position.set(-dir * 3.6, y, z).add(f.userData.off);
    f.rotation.y = dir > 0 ? 0 : Math.PI;
    f.scale.setScalar(0.85 + Math.random() * 0.35);
    scene.add(f); school.push(f);
  }
}
function updateFish(dt, t) {
  for (let i = school.length - 1; i >= 0; i--) {
    const f = school[i], u = f.userData;
    f.position.x += u.dir * u.speed * dt;
    f.position.y += Math.sin(t * 1.3 + u.phase) * 0.0012;
    f.position.z += Math.sin(t * 0.7 + u.phase) * 0.0009;
    u.tail.rotation.y = Math.sin(t * 12 + u.phase) * 0.5;
    f.rotation.y = (u.dir > 0 ? 0 : Math.PI) + Math.sin(t * 12 + u.phase - 1) * 0.06; // the whole body sways a little
    u.pecs[0].rotation.y = -0.5 + Math.sin(t * 9 + u.phase) * 0.35;
    u.pecs[1].rotation.y = 0.5 - Math.sin(t * 9 + u.phase) * 0.35;
    if (Math.abs(f.position.x) > 4) { scene.remove(f); school.splice(i, 1); }
  }
}
let nextSchool = 3 + Math.random() * 5;

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
}
const ro = new ResizeObserver(resize); ro.observe(stage);
resize();

const clock = new THREE.Clock();
const camGoal = new THREE.Vector3(), tgtGoal = new THREE.Vector3();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!reduceMotion) {
    U.uTime.value += dt;
    nextSchool -= dt;
    if (nextSchool <= 0) { spawnSchool(); nextSchool = 10 + Math.random() * 14; }
    updateFish(dt, U.uTime.value);
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
    renderer.render(globeScene, gCam);
  } else {
    if (!busy) controls.update();
    renderer.render(scene, camera);
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
  dispose() {
    if (disposed) return; disposed = true;
    renderer.setAnimationLoop(null); ro.disconnect();
    controls.dispose(); gControls.dispose();
    [space, fade, gHint, selLabel, hovLabel].forEach((el) => el.remove());
    scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    renderer.dispose();
  },
};
}
