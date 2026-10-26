/**
 * The Drowned Foundry bosses' sounds (M8): the toll, the self-toll, a stranded thrash and the
 * Coil's pulse and pylon glows each have a calm preset, and the cues reach them.
 */
import { describe, expect, it } from 'vitest';
import { sfxFenBosses } from '../../data/sfxFenBosses';
import { sfxM4 } from '../../data/sfxM4';
import { fenBossSounds } from '../../src/audio/fenBossCues';
import { m4Sounds } from '../../src/audio/m4Cues';
import type { M4AttackKey } from '../../src/app/m4Wiring';
import { M4Signals } from '../../src/app/m4Signals';
import { createAdventure, spawnEnemy, type SimEvent } from '../../src/sim';
import { roomTexts } from '../../src/app/rooms';

const at = { x: 3, y: 4 };
const windup = (attack: M4AttackKey): string[] =>
  m4Sounds({ type: 'attackWindup', attack, id: 1, ...at }).map((s) => s.id);

describe('Fen boss sounds', () => {
  it('are in the M4 preset table, quiet and rate-limited', () => {
    for (const id of Object.keys(sfxFenBosses)) {
      expect(Object.keys(sfxM4), id).toContain(id);
      const def = sfxFenBosses[id as keyof typeof sfxFenBosses];
      expect(def.gain, id).toBeLessThanOrEqual(0.35);
      expect(def.minGapMs, id).toBeGreaterThanOrEqual(400);
    }
  });

  it('play on the key telegraphs: the toll, the self-toll, the stranded thrash', () => {
    expect(windup('tollRing')).toEqual(['bellToll']);
    expect(windup('selfToll')).toEqual(['bellSelfToll']);
    expect(windup('tailThrash')).toEqual(['coilThrash']);
  });

  it('play on the pulse glow (where the Coil is) and the pylon glow (centered)', () => {
    const glow: SimEvent = { type: 'coilPulseGlow', id: 1, pulse: 'body', seconds: 1, reach: 20, x: 10, y: 12 };
    expect(fenBossSounds(glow)).toEqual([{ id: 'coilPulseGlow', x: 10, y: 12 }]);
    const pylons: SimEvent = { type: 'coilPylonGlow', id: 1, seconds: 1.2, pylons: [{ x: 1, y: 1 }] };
    expect(fenBossSounds(pylons)).toEqual([{ id: 'coilPylonHum' }]);
    expect(fenBossSounds({ type: 'coilPulse', id: 1, pulse: 'eye', damage: 1, reach: 80, x: 0, y: 0 })).toEqual([]);
  });

  it("a boss's 'telegraph' event becomes its windup cue", () => {
    const s = createAdventure({ seed: 1, rooms: roomTexts, startRoomId: 'test/boss_bellwether' });
    const boss = s.enemies.find((e) => e.kind === 'bellwether') ?? spawnEnemy(s, 'bellwether', 50, 40);
    const sig = new M4Signals();
    sig.update(s, []);
    const cues = sig.update(s, [{ type: 'telegraph', id: boss.id, attack: 'toll_ring', windup: 1.2 }]);
    expect(cues.find((c) => c.type === 'attackWindup')).toMatchObject({ attack: 'tollRing', id: boss.id });
  });
});
