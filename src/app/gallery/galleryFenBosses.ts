/**
 * Gallery exhibits of the Drowned Foundry's bosses (M8; CONTENT §5, DESIGN §10.5):
 * - fen_bosses: the Old Bellwether shelled, rung open, snapping, rolling, self-tolling on metal
 *   (its warning over the metal) and its toll ring's wave in flight;
 * - fen_bosses2: the Glasswater Coil submerged, surfaced with the lunge line, stranded and
 *   thrashing, exposed with the spit's arc, iced and overloaded;
 * - fen_bosses3: phase 3 under fog: the Body pulse glow over the player's Tide water and charge,
 *   and the pylons glowing before the storm.
 */
import { OWNER } from '../../../data/materials';
import { PLAYER_ID, type AttackShape, type GameState } from '../../sim';
import { applyElement } from '../../sim/grid/paint';
import type { ActorSpec } from './galleryActors';
import { sectionOrigin, type SectionId } from './galleryRoom';

const circle = (r: number): AttackShape => ({ kind: 'circle', r });
const line = (length: number, width: number, dirX = 1, dirY = 0): AttackShape => ({
  kind: 'line',
  length,
  width,
  dirX,
  dirY,
});
const cone = (r: number, deg: number, dirX: number, dirY: number): AttackShape => {
  const l = Math.hypot(dirX, dirY);
  return { kind: 'cone', r, halfAngleCos: Math.cos((deg * Math.PI) / 180), dirX: dirX / l, dirY: dirY / l };
};

function at(id: SectionId, specs: Array<Omit<ActorSpec, 'x' | 'y'> & { at: [number, number] }>): ActorSpec[] {
  const o = sectionOrigin(id);
  return specs.map(({ at: [x, y], ...s }) => ({ ...s, x: o.x + x, y: o.y + y }));
}

const SWIM = 16;
const CRAWL = 6;

export function fenBossSpecs(): ActorSpec[] {
  return [
    ...at('fen_bosses', [
      { kind: 'bellwether', at: [9, 12], label: 'Old Bellwether: shelled', facing: [0.3, 1] },
      {
        kind: 'bellwether',
        at: [24, 9],
        label: 'rung: open, shivering',
        wet: true,
        stun: true,
        facing: [0.3, 1],
        special: { openLeft: 4 },
      },
      {
        kind: 'bellwether',
        at: [42, 9],
        label: 'snap',
        pose: 'attack',
        facing: [0.5, 1],
        attack: { key: 'bellSnap', shape: cone(9, 35, 0.5, 1), windup: 0.8 },
      },
      {
        kind: 'bellwether',
        at: [7, 30],
        label: 'shell roll line',
        pose: 'attack',
        attack: { key: 'shellRoll', shape: line(22, 10), windup: 0.9 },
      },
      {
        kind: 'bellwether',
        at: [28, 36],
        label: 'self-toll (phase 2): the metal under it glows',
        pose: 'attack',
        phase: 2,
        attack: { key: 'selfToll', shape: circle(4.5), windup: 1.2 },
      },
      {
        kind: 'bellwether',
        at: [60, 30],
        label: 'toll ring: the wave (dodge through or stand outside)',
        pose: 'attack',
        force: 'active',
        attack: { key: 'tollRing', shape: circle(18), windup: 1.2 },
        fen: { waveR: 10 },
      },
    ]),
    ...at('fen_bosses2', [
      {
        kind: 'glasswater_coil',
        at: [14, 12],
        label: 'Glasswater Coil: submerged',
        swim: { r: 6, speed: SWIM },
        facing: [-1, 0],
        fen: { coil: 'submerged' },
      },
      {
        kind: 'glasswater_coil',
        at: [36, 12],
        label: 'surfaced: lunge line',
        facing: [-1, 0],
        swim: { r: 5, speed: SWIM, until: 1.6 },
        pose: 'attack',
        attack: { key: 'coilLunge', shape: line(27, 10, 1, 0.15), windup: 1 },
        fen: { coil: 'surfaced' },
      },
      {
        kind: 'glasswater_coil',
        at: [64, 12],
        label: 'stranded: tail thrash',
        facing: [-1, 0],
        swim: { r: 5, speed: CRAWL },
        pose: 'attack',
        attack: { key: 'tailThrash', shape: circle(7), windup: 0.7 },
        special: { stranded: true },
        fen: { coil: 'stranded' },
      },
      {
        kind: 'glasswater_coil',
        at: [12, 36],
        label: 'exposed: glass spit arc',
        facing: [-1, 0],
        swim: { r: 5, speed: SWIM, until: 1.6 },
        pose: 'attack',
        wet: true,
        attack: { key: 'glassSpit', shape: line(24, 2, 1, -0.2), windup: 0.6 },
        fen: { coil: 'exposed' },
      },
      {
        kind: 'glasswater_coil',
        at: [36, 36],
        label: 'iced',
        facing: [-1, 0],
        swim: { r: 5, speed: SWIM, until: 1.4 },
        special: { trapped: true },
        fen: { coil: 'iced' },
      },
      {
        kind: 'glasswater_coil',
        at: [64, 36],
        label: 'overloaded (stunned)',
        facing: [-1, 0],
        swim: { r: 5, speed: SWIM, until: 1.4 },
        stun: true,
        phase: 3,
        fen: { coil: 'overloaded', overloadLeft: 2 },
      },
    ]),
    ...at('fen_bosses3', [
      {
        kind: 'glasswater_coil',
        at: [36, 22],
        label: 'phase 3: Body pulse glow over your Tide water, pylons glowing, under fog',
        facing: [-1, 0],
        swim: { r: 6, speed: SWIM },
        phase: 3,
        fen: { coil: 'surfaced', pulseGlowing: true, pulseLeft: 1, pylonGlowing: true, pylonLeft: 1.2 },
      },
    ]),
  ];
}

/**
 * The phase 3 exhibit's ground: the player's Tide strip from the pool's east rim, and the
 * player's Storm on it (so the warning is seen over the player's own water and charge). Painted
 * once at boot; the gallery never ticks the grid, so it stays.
 */
export function fenBossGround(s: GameState): void {
  const o = sectionOrigin('fen_bosses3');
  const y = o.y + 22;
  const base = { owner: OWNER.player, sourceId: PLAYER_ID, hitDamage: 0, durationMult: 1 } as const;
  applyElement(s, {
    ...base,
    element: 'tide',
    shape: { kind: 'strip', x: o.x + 54, y, dirX: 1, dirY: 0, length: 20, width: 4 },
  });
  applyElement(s, { ...base, element: 'storm', shape: { kind: 'circle', x: o.x + 70, y, r: 1.5 } });
  s.events.length = 0;
}
