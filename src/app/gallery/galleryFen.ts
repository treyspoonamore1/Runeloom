/**
 * Gallery exhibits of the M8 Glasswater Fen enemies (CONTENT §5): each kind idle and with its
 * telegraph (windups held by the shots), plus its states: a Glasspike hidden, in the air and
 * stranded; a Charged Copperback; a Hot and a Cracked Slagshell; a lured Sparkfly; a bogged and a
 * stunned Mirebull; a shelled and a rung Bellshell.
 */
import type { AttackShape } from '../../sim';
import type { ActorSpec } from './galleryActors';
import { sectionOrigin, type SectionId } from './galleryRoom';

const circle = (r: number): AttackShape => ({ kind: 'circle', r });
const line = (length: number, width: number): AttackShape => ({
  kind: 'line',
  length,
  width,
  dirX: 1,
  dirY: 0,
});
const cone = (r: number, deg: number, dirX = 1, dirY = 0): AttackShape => ({
  kind: 'cone',
  r,
  halfAngleCos: Math.cos((deg * Math.PI) / 180),
  dirX,
  dirY,
});

function at(id: SectionId, specs: Array<Omit<ActorSpec, 'x' | 'y'> & { at: [number, number] }>): ActorSpec[] {
  const o = sectionOrigin(id);
  return specs.map(({ at: [x, y], ...s }) => ({ ...s, x: o.x + x, y: o.y + y }));
}

export function fenSpecs(): ActorSpec[] {
  const o = sectionOrigin('fen');
  return [
    ...at('fen', [
      {
        kind: 'glasspike',
        at: [9, 8],
        label: 'Glasspike: hidden (glint)',
        wet: true,
        special: { submerged: true },
      },
      {
        kind: 'glasspike',
        at: [26, 7],
        label: 'flash + landing circle',
        wet: true,
        pose: 'attack',
        attack: { key: 'pikeLeap', shape: circle(3), windup: 0.8, dx: 10, dy: 14 },
        special: { submerged: true },
      },
      {
        kind: 'glasspike',
        at: [50, 9],
        label: 'mid-leap',
        special: {
          leapLeft: 0.25,
          leapTime: 0.5,
          leapFromX: o.x + 44,
          leapFromY: o.y + 6,
          leapToX: o.x + 58,
          leapToY: o.y + 13,
        },
      },
      { kind: 'spark_heron', at: [70, 7], label: 'Spark Heron (wading)', wet: true },
      { kind: 'copperback', at: [8, 28], label: 'Copperback' },
      {
        kind: 'copperback',
        at: [24, 28],
        label: 'claw raise',
        pose: 'attack',
        attack: { key: 'copperPinch', shape: cone(4.8, 53), windup: 0.5 },
      },
      { kind: 'copperback', at: [40, 28], label: 'Charged', special: { chargedLeft: 3 } },
      {
        kind: 'spark_heron',
        at: [56, 30],
        label: 'beak glow, strike marker',
        pose: 'attack',
        attack: { key: 'heronBeak', shape: circle(3), windup: 1, dx: 18, dy: -4 },
      },
      { kind: 'glasspike', at: [8, 39], label: 'stranded', special: { stranded: true } },
      {
        kind: 'spark_heron',
        at: [26, 40],
        label: 'puddle spit',
        pose: 'attack',
        attack: { key: 'puddleSpit', shape: circle(3), windup: 0.8, dx: 16, dy: -2 },
      },
      { kind: 'sparkfly', at: [54, 38], label: 'Sparkfly' },
      {
        kind: 'sparkfly',
        at: [64, 38],
        label: 'zap flicker',
        pose: 'attack',
        attack: { key: 'sparkZap', shape: circle(1.2), windup: 0.25, dx: 0.7 },
      },
      { kind: 'sparkfly', at: [74, 38], label: 'lured', special: { lureLeft: 2 } },
    ]),
    ...at('fen2', [
      { kind: 'slagshell', at: [10, 9], label: 'Slagshell: Hot', special: { hot: true } },
      {
        kind: 'slagshell',
        at: [32, 9],
        label: 'slag slam',
        pose: 'attack',
        attack: { key: 'slagSlam', shape: circle(5), windup: 0.9 },
        special: { hot: true },
      },
      {
        kind: 'slagshell',
        at: [56, 9],
        label: 'Cracked (Wet)',
        wet: true,
        special: { hot: false, crackedLeft: 4 },
      },
      { kind: 'mire_bull', at: [74, 9], label: 'Mirebull' },
      {
        kind: 'mire_bull',
        at: [8, 27],
        label: 'charge line',
        pose: 'attack',
        attack: { key: 'bullCharge', shape: line(30, 4.4), windup: 0.9 },
      },
      { kind: 'mire_bull', at: [52, 26], label: 'bogged in mud', special: { boggedLeft: 2 } },
      { kind: 'mire_bull', at: [72, 27], label: 'stunned (wall)', stun: true },
      { kind: 'bellows_toad', at: [8, 38], label: 'Bellows Toad' },
      {
        kind: 'bellows_toad',
        at: [22, 37],
        label: 'inflating, croak cone',
        pose: 'attack',
        attack: { key: 'toadCroak', shape: cone(14, 30, 0.95, -0.3), windup: 1 },
      },
      { kind: 'bellshell', at: [54, 38], label: 'Bellshell: shelled', wet: true },
      {
        kind: 'bellshell',
        at: [66, 38],
        label: 'bite',
        wet: true,
        pose: 'attack',
        attack: { key: 'bellBite', shape: cone(4.5, 53), windup: 0.7 },
      },
      {
        kind: 'bellshell',
        at: [76, 36],
        label: 'rung: open',
        wet: true,
        stun: true,
        special: { openLeft: 4 },
      },
    ]),
  ];
}
