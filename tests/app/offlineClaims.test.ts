import { describe, expect, it } from 'vitest';
import { claimOffline, offlineClaimedAt } from '../../src/app/offlineClaims';

function memory() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe('offline claims', () => {
  it('remembers the latest payment per seed and never moves back', () => {
    const s = memory();
    expect(offlineClaimedAt(7, s)).toBe(0);
    claimOffline(7, 5000, s);
    claimOffline(7, 3000, s);
    claimOffline(8, 100, s);
    expect(offlineClaimedAt(7, s)).toBe(5000);
    expect(offlineClaimedAt(8, s)).toBe(100);
  });

  it('works without storage, and with storage that throws or holds junk', () => {
    expect(offlineClaimedAt(1, null)).toBe(0);
    claimOffline(1, 10, null);
    const bad = {
      getItem: () => '{not json',
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(offlineClaimedAt(1, bad)).toBe(0);
    expect(() => claimOffline(1, 10, bad)).not.toThrow();
  });
});
