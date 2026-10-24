import { afterEach, describe, expect, it, vi } from 'vitest';
import { InputSampler } from '../../src/app/input';
import { Button } from '../../src/sim';

function setup() {
  const win = new EventTarget();
  vi.stubGlobal('window', win);
  const surface = Object.assign(new EventTarget(), {
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
  }) as unknown as HTMLElement;
  const input = new InputSampler(surface);
  const key = (type: 'keydown' | 'keyup', code: string) =>
    win.dispatchEvent(Object.assign(new Event(type), { code }));
  const mouse = (target: EventTarget, type: string, button: number) =>
    target.dispatchEvent(Object.assign(new Event(type), { button, clientX: 0, clientY: 0 }));
  const sample = () => input.sample(() => ({ x: 0, y: 0 })).buttons;
  return { input, win, surface, key, mouse, sample };
}

afterEach(() => vi.unstubAllGlobals());

describe('InputSampler taps', () => {
  it('a key pressed and released between two samples still shows for one sample', () => {
    const { key, sample } = setup();
    key('keydown', 'KeyF');
    key('keyup', 'KeyF');
    expect(sample() & Button.Interact).toBe(Button.Interact);
    expect(sample() & Button.Interact).toBe(0);
  });

  it('a held key shows on every sample until released', () => {
    const { key, sample } = setup();
    key('keydown', 'Space');
    expect(sample() & Button.Dodge).toBe(Button.Dodge);
    expect(sample() & Button.Dodge).toBe(Button.Dodge);
    key('keyup', 'Space');
    expect(sample() & Button.Dodge).toBe(0);
  });

  it('a quick click between samples casts once', () => {
    const { win, surface, mouse, sample } = setup();
    mouse(surface, 'mousedown', 0);
    mouse(win, 'mouseup', 0);
    expect(sample() & Button.Cast1).toBe(Button.Cast1);
    expect(sample() & Button.Cast1).toBe(0);
  });

  it('nothing is latched while input is off (a text field has focus)', () => {
    const { input, key, sample } = setup();
    input.enabled = false;
    key('keydown', 'KeyF');
    key('keyup', 'KeyF');
    expect(sample()).toBe(0);
    input.enabled = true;
    expect(sample()).toBe(0);
  });
});
