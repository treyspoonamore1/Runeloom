import { describe, expect, it } from 'vitest';
import { sfxHearth } from '../../data/sfxHearth';
import { sfxM4 } from '../../data/sfxM4';
import { hearthSounds } from '../../src/audio/hearthCues';
import { m4Sounds } from '../../src/audio/m4Cues';

describe('Hearth sounds (M7)', () => {
  it('map station use, upgrades, the Hearth lit and returned expeditions; nothing else', () => {
    const ids = (e: Parameters<typeof hearthSounds>[0]) => hearthSounds(e).map((c) => c.id);
    expect(ids({ type: 'stationUse', station: 'cartographer' })).toEqual(['stationUse']);
    expect(ids({ type: 'buildingUpgraded', building: 'rune_garden', level: 2 })).toEqual(['buildingUpgrade']);
    expect(ids({ type: 'hearthLit', embers: 150 })).toEqual(['hearthLit']);
    expect(ids({ type: 'expeditionReturned', uid: 1, tier: 2 })).toEqual(['expeditionBell']);
    expect(ids({ type: 'rekindled', ash: 1, rekindles: 1, maxTier: 12 })).toEqual([]);
  });

  it('Embers drop silently and pick up with a quiet, rate-limited tick', () => {
    const content = { kind: 'embers' as const, amount: 3 };
    expect(m4Sounds({ type: 'lootDropped', id: 1, content, x: 0, y: 0 })).toEqual([]);
    expect(m4Sounds({ type: 'lootPicked', id: 1, content, x: 0, y: 0 })).toEqual([{ id: 'emberPickup' }]);
    expect(sfxHearth.emberPickup.gain).toBeLessThanOrEqual(0.15);
    expect(sfxHearth.emberPickup.minGapMs).toBeGreaterThanOrEqual(80);
  });

  it('are part of the M4 preset table (rendered and checked in m4Audio.test.ts)', () => {
    for (const id of Object.keys(sfxHearth)) expect(Object.keys(sfxM4)).toContain(id);
  });
});
