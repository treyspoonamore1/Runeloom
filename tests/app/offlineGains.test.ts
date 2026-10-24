import { beforeEach, describe, expect, it, vi } from 'vitest';

// applyOfflineGains sends the 'offline' edit through sendHeroEdit; record it instead of running
// the sim (the Hearth's economy is the meta agent's), and answer with the sim's offlineGains event.
const sent: unknown[] = [];
let refuse: string | null = null;
vi.mock('../../src/app/hero', () => ({
  sendHeroEdit: (_s: unknown, edit: unknown) => {
    if (refuse) return refuse;
    sent.push(edit);
    return null;
  },
}));

import { applyOfflineGains } from '../../src/app/hearth';
import type { Session } from '../../src/app/session';

const HOUR = 3600_000;
const T0 = 1_700_000_000_000;

function session(lit = true, events: unknown[] = []): Session {
  // Recording the edit moves the sim's events to the session's pending ones.
  return { pendingEvents: events, state: { hero: { hearth: { lit } }, events: [] } } as unknown as Session;
}

beforeEach(() => {
  sent.length = 0;
  refuse = null;
});

describe('applyOfflineGains on load', () => {
  it('does nothing under a minute away', () => {
    expect(applyOfflineGains(session(), T0, T0 + 59_000)).toBeNull();
    expect(applyOfflineGains(session(), T0, T0)).toBeNull();
    expect(applyOfflineGains(session(), T0, T0 - HOUR)).toBeNull(); // clock set back
    expect(sent).toEqual([]);
  });

  it('sends the whole seconds away from a minute up', () => {
    const g = applyOfflineGains(session(), T0, T0 + 60_000);
    expect(sent).toEqual([{ kind: 'offline', seconds: 60 }]);
    expect(g).toMatchObject({ seconds: 60 });
    applyOfflineGains(session(), T0, T0 + 2 * HOUR + 500);
    expect(sent[1]).toEqual({ kind: 'offline', seconds: 7200 });
  });

  it('caps the time away at 8 hours', () => {
    const g = applyOfflineGains(session(), T0, T0 + 30 * HOUR);
    expect(sent).toEqual([{ kind: 'offline', seconds: 8 * 3600 }]);
    expect(g!.seconds).toBe(8 * 3600);
    applyOfflineGains(session(), T0, T0 + 8 * HOUR);
    expect(sent[1]).toEqual({ kind: 'offline', seconds: 8 * 3600 });
  });

  it('does nothing before the Hearth is lit', () => {
    expect(applyOfflineGains(session(false), T0, T0 + 5 * HOUR)).toBeNull();
    expect(sent).toEqual([]);
  });

  it('gives nothing back when the sim refuses', () => {
    refuse = 'nope';
    expect(applyOfflineGains(session(), T0, T0 + HOUR)).toBeNull();
  });

  it('returns what the sim reported', () => {
    const ev = {
      type: 'offlineGains',
      seconds: 3600,
      scrap: 90,
      runeXp: 400,
      runeLevels: 1,
      expeditionsReturned: 2,
    };
    expect(applyOfflineGains(session(true, [ev]), T0, T0 + HOUR)).toMatchObject({
      scrap: 90,
      runeXp: 400,
      runeLevels: 1,
      expeditionsReturned: 2,
    });
  });
});
