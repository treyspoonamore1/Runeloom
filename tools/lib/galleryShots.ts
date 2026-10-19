/**
 * Screenshots of the M4 art gallery (`npm run shots -- --set gallery [--section a,b] [--perf]`):
 * one per section, windups held at 75%, plus the 300-enemy crowd at 1× zoom. --perf also measures
 * render time with 300 M4 enemies against 300 M1 enemies.
 */
import type { Page } from '@playwright/test';
import { join } from 'node:path';

export interface GalleryOptions {
  dir: string;
  milestone: string;
  only?: readonly string[];
  perf?: boolean;
}

export async function galleryShots(page: Page, url: string, o: GalleryOptions): Promise<string[]> {
  const written: string[] = [];
  await page.evaluate('window.__name = (f) => f');
  await page.goto(url);
  await page.waitForFunction(() => window.__gallery?.ready === true, undefined, { timeout: 60_000 });
  const sections = await page.evaluate(() => [...window.__gallery!.sections]);
  for (const id of [...sections, 'crowd']) {
    if (o.only && !o.only.includes(id)) continue;
    await page.evaluate(async (id) => {
      const g = window.__gallery!;
      if (id === 'crowd') g.crowd(300);
      else g.show(id as never);
      g.hold(id === 'crowd' ? null : 0.75);
      await g.advance(2.2, 10);
    }, id);
    const file = join(o.dir, `${o.milestone}_gallery_${id}.png`);
    await page.screenshot({ path: file, timeout: 120_000 });
    written.push(file);
    if (id === 'moments2') {
      // The same section 1.2 s in: the player has died and the screen has darkened.
      await page.evaluate(async () => {
        const g = window.__gallery!;
        g.show('moments2');
        await g.advance(1.2, 10);
      });
      const dead = join(o.dir, `${o.milestone}_gallery_death.png`);
      await page.screenshot({ path: dead, timeout: 120_000 });
      written.push(dead);
    }
    if (id === 'moments') {
      // A room transition 0.2 s into its fade from black.
      await page.evaluate(async () => {
        const g = window.__gallery!;
        g.roomFade();
        await g.advance(0.28, 4);
      });
      const fade = join(o.dir, `${o.milestone}_gallery_transition.png`);
      await page.screenshot({ path: fade, timeout: 120_000 });
      written.push(fade);
    }
  }
  if (o.perf) {
    for (const legacy of [false, true]) {
      const r = await page.evaluate(async (legacy) => {
        const g = window.__gallery!;
        g.crowd(300, legacy);
        await g.advance(1, 30);
        return g.measure(180);
      }, legacy);
      console.log(
        `render, 300 ${legacy ? 'M1' : 'M4'} enemies: mean ${r.mean.toFixed(2)} ms, p95 ${r.p95.toFixed(2)} ms, ${r.fps.toFixed(1)} fps (SwiftShader)`,
      );
    }
  }
  return written;
}
