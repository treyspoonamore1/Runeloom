import { signal } from '@preact/signals';
import type { VNode } from 'preact';
import { describe, expect, it, vi } from 'vitest';
import type { AdventureFlow } from '../../src/app/adventure';
import { playtestStarts } from '../../src/app/playtestStarts';
import { parseSave } from '../../src/app/saveFormat';
import type { SaveRecord } from '../../src/app/saveStore';
import { PlaytestStarts, ConfirmPlaytest, titleView, type TitleProps } from '../../src/ui/title/titleScreen';

/** Every vnode under `v` (components are called, so their output is walked too). */
function walk(v: unknown, out: VNode[] = []): VNode[] {
  if (Array.isArray(v)) v.forEach((x) => walk(x, out));
  else if (v && typeof v === 'object' && 'props' in v) {
    const n = v as VNode<Record<string, unknown>>;
    out.push(n);
    walk(n.props.children, out);
  }
  return out;
}
const click = (tree: unknown, match: (p: Record<string, unknown>) => boolean) => {
  const b = walk(tree).find((n) => match(n.props as Record<string, unknown>));
  expect(b).toBeDefined();
  (b!.props as unknown as { onClick(): void }).onClick();
};

function setup(withAutosave: boolean) {
  const importText = vi.fn(async () => null as string | null);
  const slots = signal<SaveRecord[]>(withAutosave ? [{ slot: 'auto' } as SaveRecord] : []);
  const flow = { slots, importText } as unknown as AdventureFlow;
  const onStarted = vi.fn();
  const props = { flow, onStarted, scenes: [], onScene: vi.fn(), tick: vi.fn() } as TitleProps;
  return { importText, onStarted, props };
}

describe('title screen playtest starts', () => {
  it('bundles two saves that parse', () => {
    expect(playtestStarts.map((s) => s.label)).toEqual([
      'After the Cinder Warden',
      'Mid-climb (tier 7, Hearth built)',
    ]);
    for (const s of playtestStarts) expect(parseSave(s.text).ok).toBe(true);
  });

  it('a button imports its save and starts the game when there is no autosave', async () => {
    const { importText, onStarted, props } = setup(false);
    for (const s of playtestStarts) {
      importText.mockClear();
      click(PlaytestStarts(props), (p) => p['data-start'] === s.id);
      expect(importText).toHaveBeenCalledWith(s.text);
      await vi.waitFor(() => expect(onStarted).toHaveBeenCalled());
      onStarted.mockClear();
    }
  });

  it('asks before replacing an autosave, then imports on Start', async () => {
    const { importText, onStarted, props } = setup(true);
    click(PlaytestStarts(props), (p) => p['data-start'] === 'mid_climb');
    expect(importText).not.toHaveBeenCalled();
    expect(titleView.value).toBe('confirmPlaytest');
    click(ConfirmPlaytest(props), (p) => (p as { children?: unknown }).children === 'Start');
    expect(importText).toHaveBeenCalledWith(playtestStarts[1]!.text);
    await vi.waitFor(() => expect(onStarted).toHaveBeenCalled());
    expect(titleView.value).toBe('menu');
  });
});
