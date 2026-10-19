/**
 * Storyboard screenshots of every Chemistry Lab station (BUILD_PLAN M3 acceptance: before and
 * after shots of every station), for `npm run shots -- --lab`. Each station gets a fresh page:
 * the player stands on its walkway and the station's area is captured untouched; R runs the
 * station (the same key a player presses); then the area is captured shortly after each scripted
 * step and once more when the station's effect has played out.
 */
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { labStations, type LabStation } from '../../data/lab';
import { SIM_HZ, stationArea, stationZone } from '../../src/sim';

/** Seconds to show a station's result when its label states no time. */
const DEFAULT_SHOW_SECONDS = 1.5;
/** A step's frame is taken this many seconds after it, once its effect has started to show. */
const STEP_LOOK_SECONDS = 0.4;
/** At most this many step frames per station (first, middle and last step when there are more). */
const MAX_STEP_FRAMES = 3;
/** Frames closer together than this are merged. */
const MIN_GAP_SECONDS = 0.25;
/** Cells of margin around the area in a crop; the top margin also holds the station's plaque. */
const MARGIN = { side: 1, top: 7, bottom: 1 } as const;

/**
 * When the last frame is taken: the last scripted step or action, plus the longest time in the
 * label ("burns away (6 s)", "Crates (3 s) and barricades (4 s)"), else DEFAULT_SHOW_SECONDS.
 * The same convention as the headless station tests.
 */
export function stationShowSeconds(s: LabStation): number {
  const stated = [...s.label.matchAll(/(\d+(?:\.\d+)?) s\b/g)].map((m) => Number(m[1]));
  return Math.max(0, ...actTimes(s)) + (stated.length ? Math.max(...stated) : DEFAULT_SHOW_SECONDS);
}

function actTimes(s: LabStation): number[] {
  const times = [...s.script.map((st) => st.at), ...(s.actions ?? []).map((a) => a.at)];
  if (s.spawns?.length) times.push(0);
  return [...new Set(times.map((t) => Math.max(0, t)))].sort((a, b) => a - b);
}

/** Seconds after the station starts at which to capture it, after the untouched "before" frame. */
export function stationFrameTimes(s: LabStation): number[] {
  let acts = actTimes(s);
  if (acts.length > MAX_STEP_FRAMES) acts = [acts[0]!, acts[acts.length >> 1]!, acts[acts.length - 1]!];
  const end = stationShowSeconds(s);
  const frames: number[] = [];
  for (const t of acts.map((a) => a + STEP_LOOK_SECONDS)) {
    const last = frames.length ? frames[frames.length - 1]! : 0;
    if (t - last >= MIN_GAP_SECONDS && end - t >= MIN_GAP_SECONDS) frames.push(t);
  }
  frames.push(end);
  return frames;
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

/**
 * Writes `<dir>/NN_K_tS.png` for each selected station: frame K (0 = untouched) at S seconds
 * after the station started. Returns the files.
 */
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
    const shoot = async (k: number, seconds: number): Promise<void> => {
      const file = join(dir, `${tag}_${k}_t${seconds.toFixed(1)}.png`);
      await cropShot(page, s, file);
      written.push(file);
    };
    await shoot(0, 0);
    await page.keyboard.press('KeyR');
    let tick = 0;
    for (const [k, seconds] of stationFrameTimes(s).entries()) {
      const target = Math.round(seconds * SIM_HZ);
      await page.evaluate((n) => {
        const sess = window.__runeloom!.session;
        const idle = { moveX: 0, moveY: 0, aimX: 0, aimY: 0, buttons: 0 };
        for (let i = 0; i < n; i++) sess.step(idle);
      }, target - tick);
      tick = target;
      await rafs(page);
      await shoot(k + 1, seconds);
    }
  }
  return written;
}
