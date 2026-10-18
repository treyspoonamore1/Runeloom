import { expect, test, type Page } from '@playwright/test';
import {
  createGame,
  findScenario,
  hashHex,
  hashState,
  runFrames,
  runScenario,
  scenarios,
} from '../../src/sim';
import { loadRoomText } from '../../tools/lib/rooms';
import { scenarioFrames } from '../../tools/lib/frames';

async function boot(page: Page, seed: number): Promise<void> {
  await page.goto(`/?scene=room&seed=${seed}&paused=1`);
  await page.waitForFunction(() => window.__runeloom?.ready === true, undefined, { timeout: 30_000 });
}

test.describe('browser determinism', () => {
  for (const scenario of scenarios) {
    for (const seed of [1, 2]) {
      test(`${scenario.id} seed ${seed}: page hash equals Node hash`, async ({ page }) => {
        await boot(page, 1);
        const node = hashHex(
          runScenario(scenario, loadRoomText(scenario.roomId), { seed, ticks: 10000 }).hash,
        );
        const browser = await page.evaluate(
          ([id, s]) => window.__runeloom!.runScenarioHash(id as string, 10000, s as number),
          [scenario.id, seed],
        );
        expect(browser).toBe(node);
      });
    }
  }

  test('live session frames replay in Node to the page state hash', async ({ page }) => {
    const sc = findScenario('wander')!;
    const seed = 1;
    const ticks = 3000;
    await boot(page, seed);
    const scripted = scenarioFrames(sc.id, seed, ticks);
    const result = await page.evaluate(
      ([fs, s]) => {
        const h = window.__runeloom!;
        h.session.reset({ seed: s as number });
        for (const f of fs as typeof scripted) h.session.step(f);
        return { hash: h.stateHash(), frames: h.session.frames, tick: h.session.state.tick };
      },
      [scripted, seed] as const,
    );
    expect(result.tick).toBe(ticks);
    expect(result.frames).toHaveLength(ticks);
    const node = runFrames(result.frames, loadRoomText(sc.roomId), { seed });
    expect(hashHex(node.hash)).toBe(result.hash);
    // Sanity: the recorded frames really are the scenario's, and the sim is not trivially idle.
    const fresh = createGame({ seed, roomText: loadRoomText(sc.roomId) });
    expect(hashHex(node.hash)).not.toBe(hashHex(hashState(fresh)));
  });
});
