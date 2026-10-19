import { describe, expect, it } from 'vitest';
import { Session } from '../../src/app/session';
import {
  getPassiveSummary,
  passiveAllocateBlocker,
  passiveEdges,
  passiveNodes,
  passiveNodeState,
  passivePathPreview,
  passiveRefundCheck,
  sendHeroEdit,
} from '../../src/app/hero';

describe('passive tree API for the UI (src/app/hero.ts)', () => {
  it('summarizes points, shows node states and allocates through HeroEdits', () => {
    const session = new Session({ seed: 1, roomId: 'test/m0_room', sceneId: 'room' });
    session.state.hero.level = 4;
    expect(passiveNodes.start.type).toBe('start');
    expect(passiveEdges.length).toBeGreaterThan(90);
    expect(getPassiveSummary(session)).toMatchObject({ points: 3, available: 3, refundCost: 0 });
    expect(passiveNodeState(session, 'start')).toBe('allocated');
    expect(passiveNodeState(session, 'weaver_n')).toBe('available');
    expect(passiveNodeState(session, 'ember_s1')).toBe('locked');
    expect(passiveAllocateBlocker(session, 'ember_s1')).toMatch(/connected/);
    expect(passivePathPreview(session, 'ember_s2')).toEqual(['weaver_n', 'ember_s1', 'ember_s2']);
    for (const n of passivePathPreview(session, 'ember_s2')!)
      expect(sendHeroEdit(session, { kind: 'allocate', node: n })).toBeNull();
    expect(getPassiveSummary(session).available).toBe(0);
    expect(getPassiveSummary(session).allocated.has('ember_s2')).toBe(true);
    expect(passiveRefundCheck(session, 'ember_s1').ok).toBe(false);
    expect(passiveRefundCheck(session, 'ember_s2').ok).toBe(true);
    expect(session.state.heroMods.damageInc.fire).toBeCloseTo(0.16);
  });
});
