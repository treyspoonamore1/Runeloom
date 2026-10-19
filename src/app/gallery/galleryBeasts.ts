/**
 * Enemy exhibits of the gallery: every M4 kind in its idle, move and attack poses and special
 * states (submerged, fuse, frozen, phases), the rarity looks, and the attack telegraphs.
 */
import type { AttackShape } from '../../sim';
import type { ActorSpec } from './galleryActors';
import { sectionOrigin, type SectionId } from './galleryRoom';

const circle = (r: number): AttackShape => ({ kind: 'circle', r });
const line = (length: number, width: number): AttackShape => ({ kind: 'line', length, width, dirX: 1, dirY: 0 });
const cone = (r: number, deg: number): AttackShape => ({ kind: 'cone', r, halfAngleCos: Math.cos((deg * Math.PI) / 180), dirX: 1, dirY: 0 });

function at(id: SectionId, specs: Array<Omit<ActorSpec, 'x' | 'y'> & { at: [number, number] }>): ActorSpec[] {
  const o = sectionOrigin(id);
  return specs.map(({ at: [x, y], ...s }) => ({ ...s, x: o.x + x, y: o.y + y }));
}

export function beastSpecs(): ActorSpec[] {
  return [
    ...at('beasts', [
      { kind: 'bog_lurker', at: [10, 8], label: 'Bog Lurker: submerged', wet: true },
      { kind: 'bog_lurker', at: [30, 8], label: 'ripple telegraph', wet: true, pose: 'attack', attack: { key: 'lurkerLunge', shape: line(10, 3), windup: 1.2 } },
      { kind: 'bog_lurker', at: [56, 8], label: 'surfaced lunge', wet: true, pose: 'attack', attack: { key: 'lurkerLunge', shape: line(10, 3), windup: 1.2 }, force: 'recover' },
      { kind: 'tar_hulk', at: [10, 25], label: 'Tar Hulk' },
      { kind: 'tar_hulk', at: [28, 25], label: 'move', pose: 'move' },
      { kind: 'tar_hulk', at: [48, 25], label: 'slam windup', pose: 'attack', attack: { key: 'hulkSlam', shape: circle(5), windup: 0.9 } },
      { kind: 'tar_hulk', at: [70, 25], label: 'fuse lit (Oiled + burning)', oiled: true, burning: 1.1 },
      { kind: 'frost_wisp', at: [10, 40], label: 'Frost Wisp (over deep water)' },
      { kind: 'frost_wisp', at: [30, 40], label: 'move', pose: 'move' },
      { kind: 'frost_wisp', at: [48, 40], label: 'frost line windup', pose: 'attack', attack: { key: 'wispFrostLine', shape: line(16, 2.4), windup: 1.0 } },
    ]),
    ...at('beasts2', [
      { kind: 'stormcaller', at: [10, 9], label: 'Stormcaller' },
      { kind: 'stormcaller', at: [26, 9], label: 'move', pose: 'move' },
      { kind: 'stormcaller', at: [42, 9], label: 'strike windup', pose: 'attack', attack: { key: 'stormStrike', shape: circle(3), windup: 1.0, dx: 22, dy: 0 } },
      { kind: 'kiln_mite', at: [10, 24], label: 'Kiln Mite' },
      { kind: 'kiln_mite', at: [26, 24], label: 'move', pose: 'move' },
      { kind: 'kiln_mite', at: [42, 24], label: 'nip', pose: 'attack', attack: { key: 'miteNip', shape: circle(1.2), windup: 0.3, dx: 1.2 } },
      { kind: 'tinderling', at: [58, 24], label: 'Tinderling (size ref)' },
      { kind: 'shieldbearer', at: [72, 24], label: 'Shieldbearer (ref)' },
      { kind: 'brood_kiln', at: [12, 40], label: 'Brood Kiln: idle' },
      { kind: 'brood_kiln', at: [36, 40], label: 'spawning', spawns: true },
      { kind: 'brood_kiln', at: [60, 40], label: 'Frozen', frozen: true },
    ]),
    ...at('matriarch', [
      { kind: 'tar_matriarch', at: [16, 14], label: 'Tar Matriarch' },
      { kind: 'tar_matriarch', at: [56, 14], label: 'slam windup', pose: 'attack', attack: { key: 'matriarchSlam', shape: circle(6), windup: 1.0 } },
      { kind: 'tar_matriarch', at: [16, 38], label: 'summoning', pose: 'attack', attack: { key: 'summon', shape: circle(0.01), windup: 1.2 }, force: 'active' },
      { kind: 'tar_matriarch', at: [46, 38], label: 'tar glob windup', pose: 'attack', attack: { key: 'tarGlob', shape: circle(2), windup: 0.8, dx: 22, dy: -4 } },
    ]),
    ...at('warden', [
      { kind: 'cinder_warden', at: [10, 13], label: 'Cinder Warden: phase 1' },
      { kind: 'cinder_warden', at: [32, 13], label: 'charge windup', pose: 'attack', attack: { key: 'wardenCharge', shape: line(18, 9), windup: 1.0 } },
      { kind: 'cinder_warden', at: [66, 13], label: 'fire slam windup', pose: 'attack', attack: { key: 'fireSlam', shape: circle(6), windup: 0.8 } },
      { kind: 'cinder_warden', at: [12, 37], label: 'phase 2: Superheated, wet', life: 0.5, wet: true },
      { kind: 'cinder_warden', at: [36, 37], label: 'phase 2: frozen (Superheat broken)', life: 0.5, wet: true, frozen: true },
      { kind: 'cinder_warden', at: [68, 34], label: 'phase 3: brazier storm', life: 0.2, pose: 'attack', attack: { key: 'brazierStorm', shape: circle(0.01), windup: 1.2 } },
    ]),
  ];
}

export function raritySpecs(): ActorSpec[] {
  return at('rarity', [
    { kind: 'tar_hulk', at: [10, 12], label: 'normal' },
    { kind: 'tar_hulk', at: [30, 12], label: 'Magic', rarity: 'magic', mods: ['hasted'] },
    { kind: 'tar_hulk', at: [56, 12], label: 'Rare', rarity: 'rare', mods: ['hasted', 'incendiary', 'thick_skinned'] },
    { kind: 'stormcaller', at: [10, 34], label: 'normal' },
    { kind: 'stormcaller', at: [24, 34], label: 'Magic', rarity: 'magic', mods: ['grounded'] },
    { kind: 'stormcaller', at: [40, 34], label: 'Rare', rarity: 'rare', mods: ['hasted', 'volatile'] },
    { kind: 'kiln_mite', at: [54, 34], label: 'Magic mite', rarity: 'magic' },
    { kind: 'tinderling', at: [64, 34], label: 'Rare', rarity: 'rare', mods: ['incendiary', 'swarming'] },
    { kind: 'frost_wisp', at: [74, 34], label: 'Magic', rarity: 'magic', mods: ['frostbound'] },
  ]);
}

/** One exhibit per new attack telegraph, held mid-windup in the shots. */
export function telegraphSpecs(): ActorSpec[] {
  return [
    ...at('telegraphs', [
      { kind: 'bog_lurker', at: [12, 8], label: 'Lurker ripple 1.2 s', wet: true, pose: 'attack', attack: { key: 'lurkerLunge', shape: line(10, 3), windup: 1.2 } },
      { kind: 'tar_hulk', at: [44, 9], label: 'Hulk slam (5)', pose: 'attack', attack: { key: 'hulkSlam', shape: circle(5), windup: 0.9 } },
      { kind: 'tar_hulk', at: [68, 9], label: 'Hulk fuse (6)', oiled: true, burning: 1.1 },
      { kind: 'frost_wisp', at: [6, 26], label: 'Wisp frost line (16)', pose: 'attack', attack: { key: 'wispFrostLine', shape: line(16, 2.4), windup: 1.0 } },
      { kind: 'stormcaller', at: [36, 26], label: 'Stormcaller strike', pose: 'attack', attack: { key: 'stormStrike', shape: circle(3), windup: 1.0, dx: 14, dy: 0 } },
      { kind: 'tar_matriarch', at: [14, 39], label: 'Matriarch slam (6)', pose: 'attack', attack: { key: 'matriarchSlam', shape: circle(6), windup: 1.0 } },
      { kind: 'tar_matriarch', at: [40, 40], label: 'Tar glob marker', pose: 'attack', attack: { key: 'tarGlob', shape: circle(2), windup: 0.8, dx: 26, dy: -6 } },
    ]),
    ...at('telegraphs2', [
      { kind: 'cinder_warden', at: [8, 12], label: 'Warden charge line', pose: 'attack', attack: { key: 'wardenCharge', shape: line(22, 9), windup: 1.0 } },
      { kind: 'cinder_warden', at: [46, 12], label: 'Warden fire slam (6)', pose: 'attack', attack: { key: 'fireSlam', shape: circle(6), windup: 0.8 } },
      { kind: 'cinder_warden', at: [8, 38], label: 'Warden fire breath (12)', life: 0.5, pose: 'attack', attack: { key: 'fireBreath', shape: cone(12, 30), windup: 0.6 } },
      { kind: 'cinder_warden', at: [40, 38], label: 'Brazier storm glow', life: 0.2, pose: 'attack', attack: { key: 'brazierStorm', shape: circle(0.01), windup: 1.2 } },
    ]),
  ];
}
