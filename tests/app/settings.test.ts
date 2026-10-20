import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('settings', () => {
  it('defaults Ambient to 60% and persists it with the other settings', async () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    const { settings, updateSettings } = await import('../../src/app/settings');
    expect(settings.ambient).toBe(0.6);
    updateSettings({ ambient: 0.25 });
    vi.resetModules();
    const again = await import('../../src/app/settings');
    expect(again.settings.ambient).toBe(0.25);
    expect(again.settings.volume).toBe(0.7);
  });

  it('gives an older save without Ambient the default', async () => {
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ volume: 0.4 }), setItem: () => {} });
    const { settings } = await import('../../src/app/settings');
    expect(settings.ambient).toBe(0.6);
    expect(settings.volume).toBe(0.4);
  });
});
