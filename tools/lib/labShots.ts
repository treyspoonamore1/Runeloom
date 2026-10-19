/**
 * Before and after screenshots of every Chemistry Lab station (BUILD_PLAN M3 acceptance), for
 * `npm run shots -- --lab`. Each station gets a fresh page: the player stands on its walkway, the
 * station's area is captured untouched, R runs the station (the same key a player presses), the
 * sim steps until the station's effect shows, and the area is captured again.
 */
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { labStations, type LabStation } from '../../data/lab';
import { SIM_HZ, stationArea, stationZone } from '../../src/sim';

/** Seconds to show a station's result when its label states no time. */
const DEFAULT_SHOW_SECONDS = 1.5;
/** Cells of margin around the area in a crop; the top margin also holds the station's plaque. */
const MARGIN = { side: 1, top: 7, bottom: 1 } as const;

/**
 * When the "after" shot is taken: the last scripted step or action, plus the longest time in the
 * label ("burns away (6 s)", "Crates (3 s) and barricades (4 s)"), else DEFAULT_SHOW_SECONDS.
 * The same convention as the headless station tests.
 */
export function stationShowSeconds(s: LabStation): number {
  const acts = [...s.script.map((st) => st.at), ...(s.actions ?? []).map((a) => a.at), 0];
  const stated = [...s.label.matchAll(/(\d+(?:\.\d+)?) s\b/g)].map((m) => Number(m[1]));
  return Math.max(...acts) + (stated.length ? Math.max(...stated) : DEFAULT_SHOW_SECONDS);
}

interface Xf {
  scale: number;
  ox: number;
  oy: number;
}

async function rafs(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );
}

async function cropShot(page: Page, s: LabStation, file: string): Promise<void> {
  const xf: Xf = await page.evaluate(() => {
    const r = window.__runeloom!.renderer;
    const a = r.screenToWorld(0, 0);
    const b = r.screenToWorld(1, 1);
    const scale = 1 / (b.x - a.x);
    return { scale, ox: -a.x * scale, oy: -a.y * scale };
  });
  const area = stationArea(s);
  const vp = page.viewportSize()!;
  const x0 = Math.max(0, (area.x0 - MARGIN.side) * xf.scale + xf.ox);
  const y0 = Math.max(0, (area.y0 - MARGIN.top) * xf.scale + xf.oy);
  const x1 = Math.min(vp.width, (area.x1 + MARGIN.side) * xf.scale + xf.ox);
  const y1 = Math.min(vp.height, (area.y1 + MARGIN.bottom) * xf.scale + xf.oy);
  await page.screenshot({ path: file, clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } });
}

/** Writes `<dir>/NN_before.png` and `<dir>/NN_after.png` for each selected station; returns the files. */
export async function labShots(
  page: Page,
  url: string,
  dir: string,
  only: readonly number[] | undefined,
): Promise<string[]> {
  const written: string[] = [];
  const indices = only ?? labStations.map((_, i) => i);
  for (const index of indices) {
    const s = labStations[index]!;
    const zone = stationZone(s);
    const stand = { x: (zone.x0 + zone.x1) / 2, y: zone.y1 - 4 };
    await page.goto(url);
    await page.waitForFunction(() => window.__runeloom?.ready === true, undefined, { timeout: 30_000 });
    await page.addStyleTag({ content: '#ui { display: none !important; }' });
    await page.evaluate((p) => {
      const h = window.__runeloom!;
      const st = h.session.state;
      st.cheats.god = true;
      st.player.x = st.player.prevX = p.x;
      st.player.y = st.player.prevY = p.y;
      h.session.markEdited();
      // setRoom snaps the camera onto the moved player.
      h.renderer.setRoom(st);
    }, stand);
    await rafs(page);
    const tag = String(index).padStart(2, '0');
    const before = join(dir, `${tag}_before.png`);
    await cropShot(page, s, before);
    await page.keyboard.press('KeyR');
    const ticks = Math.round(stationShowSeconds(s) * SIM_HZ);
    await page.evaluate((n) => {
      const sess = window.__runeloom!.session;
      const idle = { moveX: 0, moveY: 0, aimX: 0, aimY: 0, buttons: 0 };
      for (let i = 0; i < n; i++) sess.step(idle);
    }, ticks);
    await rafs(page);
    const after = join(dir, `${tag}_after.png`);
    await cropShot(page, s, after);
    written.push(before, after);
  }
  return written;
}
