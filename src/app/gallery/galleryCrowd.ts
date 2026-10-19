/**
 * The gallery's crowd stress test: N mixed enemies wandering a meadow at 1× zoom, for readability
 * among 300 enemies and render-cost measurements. `legacy` uses the M1 kinds as a baseline.
 */
import type { ActorSpec } from './galleryActors';
import type { M4Kind } from '../../render/bestiary/bestiaryPalette';

const MIX: Array<[M4Kind, number]> = [
  ['kiln_mite', 100],
  ['frost_wisp', 50],
  ['stormcaller', 50],
  ['tar_hulk', 45],
  ['bog_lurker', 35],
  ['brood_kiln', 12],
  ['tar_matriarch', 4],
  ['cinder_warden', 4],
];
const LEGACY: Array<[ActorSpec['kind'], number]> = [
  ['tinderling', 160],
  ['ember_archer', 80],
  ['shieldbearer', 60],
];

/** Deterministic spread over the crowd room (cells), so measurements compare like with like. */
export function crowdSpecs(n: number, legacy: boolean): ActorSpec[] {
  const mix = legacy ? LEGACY : MIX;
  const total = mix.reduce((a, [, c]) => a + c, 0);
  const out: ActorSpec[] = [];
  let seed = 12345;
  const rnd = (): number => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
  for (const [kind, count] of mix) {
    const k = Math.round((count / total) * n);
    for (let i = 0; i < k && out.length < n; i++) {
      const r = rnd();
      const static_ = kind === 'brood_kiln';
      out.push({
        kind,
        x: 28 + rnd() * 152,
        y: 22 + rnd() * 84,
        label: '',
        pose: static_ ? 'idle' : r < 0.12 ? 'attack' : 'move',
        attack: r < 0.12 ? { key: 'hulkSlam', shape: { kind: 'circle', r: 3 }, windup: 0.9 } : undefined,
        rarity: r > 0.97 ? 'rare' : r > 0.87 ? 'magic' : 'normal',
        mods: r > 0.97 ? ['hasted', 'incendiary'] : undefined,
        wet: kind === 'bog_lurker',
      });
    }
  }
  return out;
}
