// Export the Reef Pulse coral as SVG (to paste or drag into Figma).
// Usage (Node 22+), from the project root:
//   node scripts/export_coral_svg.mjs --reef "Central and northern Great Barrier Reef" --level 0.4 > coral.svg
//   node scripts/export_coral_svg.mjs --seed 7 --level 0 --width 1200 > coral.svg
// --level: 0 = healthy, 1 = fully bleached (in the app: risk / 60).
import { readFileSync } from 'node:fs';
import { makeTree, coralToSVG } from '../client/src/reefpulse/coral.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]]);
  return acc;
}, []));

let seed = args.seed != null ? Number(args.seed) : null;
if (args.reef) {
  const data = JSON.parse(readFileSync(new URL('../client/src/reefpulse/data/reefPulse.json', import.meta.url)));
  const reef = data.reefs.find((r) => r.name.toLowerCase().startsWith(args.reef.toLowerCase()));
  if (!reef) { console.error(`No reef starts with "${args.reef}"`); process.exit(1); }
  seed = reef.id;
}
if (seed == null) seed = 0;

// The app builds each reef's coral with makeTree(reef.id + 1).
const tree = makeTree(seed + 1);
process.stdout.write(coralToSVG(tree, Number(args.level ?? 0), { width: Number(args.width ?? 800), background: args.bg ?? null }));
