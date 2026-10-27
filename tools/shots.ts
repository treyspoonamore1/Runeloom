/**
 * Screenshots of debug scenes into shots/.
 *   npm run shots [-- --scene room] [--milestone m0] [--ticks N] [--viewport 390x844]
 *   npm run shots -- --lab [--station 3,7]   Chemistry Lab station storyboards into shots/lab/
 *   npm run shots -- --set creature [--milestone m3]   entities on the chemistry grid (wet, oiled, falls, arcs...)
 *   npm run shots -- --set rooms [--room e1,k7] [--port 5197]   every region room: whole-room fit and play zoom
 *   npm run shots -- --set hearth [--shot unlit,mid,max] [--viewport 390x844]   the Hearth's hub (M7):
 *       empty plots, mid and max buildings, fit and play zoom
 *   npm run shots -- --set onload [--region kiln] [--milestone m4]   every room on load, as an adventure game,
 *       into shots/rooms/<milestone>_<region>_<room>.png (--ticks N steps idle first)
 *   npm run shots -- --set ui [--milestone m4] [--shot inventory,tree] [--viewport 390x844]   M4 menus and HUD with fixture data
 *   npm run shots -- --set gallery [--section beasts,loot] [--perf] [--milestone m4]   M4 art gallery
 *   npm run shots -- --set item [--milestone m4] [--shot frost_panel]   the K6 rune shrine and the
 *       new-element panels (Frost at the shrine, Storm after the Cinder Warden)
 *   npm run shots -- --set fight [--room k5] [--at 4,12,20] [--milestone m4]   a boss fight as the
 *       encounter sim plays it (campaign bot, reference character), whole room, at each fight second in --at;
 *       --room bellwether|coil plays the Fen boss arenas; --view fit,play adds play zoom; --viewport 390x844
 *   npm run shots -- --set fen [--shot fog,vents] [--viewport 390x844] [--milestone m8]   M8 Fen looks: fog and
 *       lantern, gusts and room wind, vents, borrowed terrain, pylon warning, F1 overlays, palettes
 *   npm run shots -- --set spells [--shot lob_gale,bolt_gale] [--ticks N]   one weave cast once in
 *       test/fen_render, shot mid-flight, at landing and through its gust (or only at tick N)
 *   npm run shots -- --scenario weave_m5 --ticks 300 [--milestone m5]   a sim scenario (src/sim/scenarios.ts)
 *       set up and played in the browser for --ticks, then shot
 * Starts a Vite dev server on a free port and a headless Chromium; always shuts both down.
 */
import { mkdirSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';
import { scenarios } from '../src/sim';
import { scenes } from '../src/app/scenes';
import { ArgError, parseArgs, parseViewport, requireInt, runCli } from './lib/args';
import { scenarioFrames } from './lib/frames';
import { labShots } from './lib/labShots';
import { creatureShotIds, runCreatureShot } from './lib/creatureShots';
import { listRoomIds } from './lib/rooms';
import { authoredRegionRooms, showRoom, type RoomShort } from './lib/roomShots';
import { worldRooms } from '../data/progression';
import { runUiShot, uiShotIds, uiShotUrl, type UiShotId } from './lib/uiShots';
import { galleryShots } from './lib/galleryShots';
import { itemShotIds, itemShotUrl, runItemShot, type ItemShotId } from './lib/itemShots';
import { showFight } from './lib/fightShots';
import { hearthShotIds, showHearth, type HearthShotId } from './lib/hearthShots';
import { fenShotIds, runFenShot, type FenShotId } from './lib/fenShots';
import { SPELL_SHOT_TICKS, spellShotIds, spellShotSet, type SpellShotId } from './lib/spellShots';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SHOTS_DIR = join(ROOT, 'shots');
const GL_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const SEED = 1;

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createNetServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as { port: number };
      srv.close(() => resolve(port));
    });
  });
}

runCli(async () => {
  const a = parseArgs(process.argv.slice(2), {
    scene: { kind: 'string' },
    milestone: { kind: 'string', default: 'm0' },
    ticks: { kind: 'number', default: 0 },
    viewport: { kind: 'string', default: '1280x720' },
    lab: { kind: 'boolean' },
    station: { kind: 'string' },
    set: {
      kind: 'string',
      help: "'creature': entities on the chemistry grid (lab stations); 'rooms': region rooms (fit and play zoom); 'hearth': the Hearth's hub (M7); 'onload': every room on load as an adventure game; 'ui': M4 menus and HUD; 'gallery': M4 art; 'item': the K6 shrine and new-element panels",
    },
    room: { kind: 'string', help: 'with --set rooms: comma-separated short ids (e1,k7)' },
    region: { kind: 'string', help: "--set onload: only rooms whose id starts with this, e.g. 'kiln'" },
    port: { kind: 'number', default: 0, help: 'dev server port (0: any free port)' },
    shot: {
      kind: 'string',
      help: `with --set ui: some of ${uiShotIds.join(', ')}; with --set item: some of ${itemShotIds.join(', ')}; with --set fen: some of ${fenShotIds.join(', ')}`,
    },
    section: { kind: 'string', help: 'gallery sections to shoot, comma-separated (default all, plus crowd)' },
    perf: { kind: 'boolean', help: 'gallery: measure render time with 300 M4 and 300 M1 enemies' },
    at: { kind: 'string', default: '4,12,20', help: '--set fight: fight seconds to shoot, comma-separated' },
    view: { kind: 'string', help: "--set fight: 'fit' (whole room, default), 'play' (play zoom on the fight), or both: fit,play" },
    scenario: { kind: 'string', help: 'a scenario id (src/sim/scenarios.ts): set up, play --ticks, shoot' },
  });
  const viewport = parseViewport(a.viewport!);
  const ticks = requireInt('ticks', a.ticks, 0);
  const milestone = a.milestone!;
  if (!/^[\w-]+$/.test(milestone))
    throw new ArgError(`--milestone must be a simple name, got "${milestone}"`);
  const selected = scenes.filter((s) => a.scene === undefined || s.id === a.scene);
  if (selected.length === 0)
    throw new ArgError(`Unknown scene "${a.scene}". Available: ${scenes.map((s) => s.id).join(', ')}`);

  mkdirSync(SHOTS_DIR, { recursive: true });
  let server: ViteDevServer | undefined;
  let browser: Browser | undefined;
  const written: string[] = [];
  try {
    const port = a.port ? requireInt('port', a.port, 1) : await freePort();
    server = await createServer({
      root: ROOT,
      logLevel: 'error',
      // No HMR: an edit while shots run must not reload the page mid-capture.
      server: { port, strictPort: true, host: '127.0.0.1', hmr: false },
    });
    await server.listen();
    browser = await chromium.launch({ headless: true, args: GL_ARGS });
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    if (a.lab) {
      const dir = join(SHOTS_DIR, 'lab');
      mkdirSync(dir, { recursive: true });
      const only = a.station?.split(',').map((v) => requireInt('station', Number(v), 0));
      const url = `http://127.0.0.1:${port}/?scene=lab&seed=${SEED}&paused=1`;
      written.push(...(await labShots(page, url, dir, only)));
      if (errors.length) console.warn(`warning: page errors in the lab: ${errors.join('; ')}`);
      selected.length = 0;
    }

    if (a.set === 'creature') {
      for (const id of creatureShotIds) {
        errors.length = 0;
        await page.goto(`http://127.0.0.1:${port}/?scene=lab&seed=${SEED}&paused=1`);
        await page.waitForFunction(() => window.__runeloom?.ready === true, undefined, { timeout: 30_000 });
        await runCreatureShot(page, id);
        await page.waitForTimeout(500);
        const file = join(SHOTS_DIR, `${milestone}_creature_${id}.png`);
        await page.screenshot({ path: file, timeout: 120_000 });
        written.push(file);
        if (errors.length) console.warn(`warning: page errors in creature shot ${id}: ${errors.join('; ')}`);
      }
    } else if (a.set === 'rooms') {
      const all = authoredRegionRooms();
      const only = a.room?.split(',') as RoomShort[] | undefined;
      for (const s of only ?? all) {
        if (!all.includes(s))
          throw new ArgError(`Unknown or unauthored room "${s}". Available: ${all.join(', ')}`);
        for (const view of ['fit', 'play'] as const) {
          errors.length = 0;
          await page.goto(`http://127.0.0.1:${port}/?scene=adventure&seed=${SEED}&paused=1`);
          await page.waitForFunction(() => window.__runeloom?.ready === true, undefined, { timeout: 30_000 });
          await showRoom(page, worldRooms[s], view);
          const file = join(SHOTS_DIR, `${milestone}_room_${s}_${view}.png`);
          await page.screenshot({ path: file, timeout: 120_000 });
          written.push(file);
          if (errors.length) console.warn(`warning: page errors in room ${s}: ${errors.join('; ')}`);
        }
      }
    } else if (a.set === 'hearth') {
      const only = (a.shot?.split(',') ?? [...hearthShotIds]) as HearthShotId[];
      const vp = `${viewport.width}x${viewport.height}`;
      for (const id of only) {
        if (!hearthShotIds.includes(id))
          throw new ArgError(`Unknown hearth shot "${id}". Available: ${hearthShotIds.join(', ')}`);
        for (const view of ['fit', 'play'] as const) {
          errors.length = 0;
          await page.goto(`http://127.0.0.1:${port}/?scene=adventure&seed=${SEED}&paused=1`);
          await page.waitForFunction(() => window.__runeloom?.ready === true, undefined, { timeout: 30_000 });
          await showHearth(page, id, view);
          const file = join(SHOTS_DIR, `${milestone}_hearth_${id}_${view}_${vp}.png`);
          await page.screenshot({ path: file, timeout: 120_000 });
          written.push(file);
          if (errors.length) console.warn(`warning: page errors in hearth shot ${id}: ${errors.join('; ')}`);
        }
      }
    } else if (a.set === 'onload') {
      const dir = join(SHOTS_DIR, 'rooms');
      mkdirSync(dir, { recursive: true });
      const ids = listRoomIds().filter((id) => a.region === undefined || id.startsWith(`${a.region}/`));
      if (ids.length === 0) throw new ArgError(`No rooms in region "${a.region}"`);
      await page.goto(`http://127.0.0.1:${port}/?scene=adventure&seed=${SEED}&paused=1`);
      await page.waitForFunction(() => window.__runeloom?.ready === true, undefined, { timeout: 30_000 });
      for (const id of ids) {
        errors.length = 0;
        await page.evaluate(
          ([roomId, n]) => {
            const s = window.__runeloom!.session;
            s.reset({ roomId, mode: 'adventure' });
            for (let i = 0; i < n; i++) s.step({ moveX: 0, moveY: 0, aimX: 0, aimY: 0, buttons: 0 });
          },
          [id, ticks] as const,
        );
        await page.evaluate(
          () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
        );
        const file = join(dir, `${milestone}_${id.replace(/\//g, '_')}.png`);
        await page.screenshot({ path: file, timeout: 120_000 });
        written.push(file);
        if (errors.length) console.warn(`warning: page errors in room ${id}: ${errors.join('; ')}`);
      }
    } else if (a.set === 'ui') {
      const only = a.shot?.split(',') ?? [...uiShotIds];
      const bad = only.filter((x) => !(uiShotIds as readonly string[]).includes(x));
      if (bad.length)
        throw new ArgError(`Unknown --shot ${bad.join(', ')}. Available: ${uiShotIds.join(', ')}`);
      const suffix = a.viewport === '1280x720' ? '' : `_${a.viewport}`;
      for (const id of only as UiShotId[]) {
        errors.length = 0;
        // A fresh context per shot: each starts with empty IndexedDB and localStorage.
        const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
        const p = await ctx.newPage();
        p.on('pageerror', (e) => errors.push(e.message));
        await p.goto(uiShotUrl(`http://127.0.0.1:${port}`, id));
        await p.waitForFunction(() => window.__runeloom?.ready === true, undefined, { timeout: 30_000 });
        await runUiShot(p, id);
        const file = join(SHOTS_DIR, `${milestone}_ui_${id}${suffix}.png`);
        await p.screenshot({ path: file, timeout: 120_000 });
        console.log(`shot ${id}`);
        written.push(file);
        await ctx.close();
        if (errors.length) console.warn(`warning: page errors in ui shot ${id}: ${errors.join('; ')}`);
      }
    } else if (a.set === 'item') {
      const only = a.shot?.split(',') ?? [...itemShotIds];
      const bad = only.filter((x) => !(itemShotIds as readonly string[]).includes(x));
      if (bad.length)
        throw new ArgError(`Unknown --shot ${bad.join(', ')}. Available: ${itemShotIds.join(', ')}`);
      for (const id of only as ItemShotId[]) {
        errors.length = 0;
        const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
        const p = await ctx.newPage();
        p.on('pageerror', (e) => errors.push(e.message));
        await p.goto(itemShotUrl(`http://127.0.0.1:${port}`));
        await p.waitForFunction(() => window.__runeloom?.ready === true, undefined, { timeout: 30_000 });
        await runItemShot(p, id);
        const file = join(SHOTS_DIR, `${milestone}_item_${id}.png`);
        await p.screenshot({ path: file, timeout: 120_000 });
        console.log(`shot ${id}`);
        written.push(file);
        await ctx.close();
        if (errors.length) console.warn(`warning: page errors in item shot ${id}: ${errors.join('; ')}`);
      }
    } else if (a.set === 'fen') {
      const only = (a.shot?.split(',') ?? [...fenShotIds]) as FenShotId[];
      const vp = `${viewport.width}x${viewport.height}`;
      for (const id of only) {
        if (!fenShotIds.includes(id))
          throw new ArgError(`Unknown fen shot "${id}". Available: ${fenShotIds.join(', ')}`);
        errors.length = 0;
        await page.goto(`http://127.0.0.1:${port}/?scene=adventure&seed=${SEED}&paused=1`);
        await page.waitForFunction(() => window.__runeloom?.ready === true, undefined, { timeout: 30_000 });
        const note = await runFenShot(page, id);
        const file = join(SHOTS_DIR, `${milestone}_fen_${id}_${vp}.png`);
        await page.screenshot({ path: file, timeout: 120_000 });
        console.log(`shot ${id}: ${note}`);
        written.push(file);
        // The borrowed flicker blinks: a few more moments, 70 ms apart.
        for (const k of id === 'borrowed' ? ['b', 'c', 'd'] : []) {
          await page.evaluate(async () => {
            const R = window.__runeloom!;
            R.renderer.render(R.session.state, 1, 0.07);
            await new Promise<void>((r) => requestAnimationFrame(() => r()));
          });
          const more = join(SHOTS_DIR, `${milestone}_fen_${id}_${k}_${vp}.png`);
          await page.screenshot({ path: more, timeout: 120_000 });
          written.push(more);
        }
        if (errors.length) console.warn(`warning: page errors in fen shot ${id}: ${errors.join('; ')}`);
      }
    } else if (a.set === 'gallery') {
      const url = `http://127.0.0.1:${port}/?scene=gallery`;
      const only = a.section?.split(',');
      written.push(
        ...(await galleryShots(page, url, { dir: SHOTS_DIR, milestone, only, perf: a.perf === true })),
      );
      if (errors.length) console.warn(`warning: page errors in the gallery: ${errors.join('; ')}`);
    } else if (a.set === 'fight') {
      const room = a.room ?? 'k5';
      const vp = a.viewport === '1280x720' ? '' : `_${a.viewport}`;
      const views = (a.view ?? 'fit').split(',') as ('fit' | 'play')[];
      for (const at of a.at!.split(',').map(Number))
        for (const view of views) {
          errors.length = 0;
          await page.goto(`http://127.0.0.1:${port}/?scene=adventure&seed=${SEED}&paused=1`);
          await page.waitForFunction(() => window.__runeloom?.ready === true, undefined, { timeout: 30_000 });
          console.log(await showFight(page, { room, seed: SEED, at, view }));
          const tag = view === 'fit' ? '' : `_${view}`;
          const file = join(SHOTS_DIR, `${milestone}_fight_${room}_${String(at).replace('.', '_')}s${tag}${vp}.png`);
          await page.screenshot({ path: file, timeout: 120_000 });
          written.push(file);
          if (errors.length) console.warn(`warning: page errors in fight shot ${at}: ${errors.join('; ')}`);
        }
    } else if (a.scenario !== undefined) {
      const sc = scenarios.find((s) => s.id === a.scenario);
      if (!sc)
        throw new ArgError(
          `Unknown --scenario "${a.scenario}". Available: ${scenarios.map((s) => s.id).join(', ')}`,
        );
      const scene = scenes.find(
        (s) => s.roomId === sc.roomId && (s.mode ?? 'sandbox') === (sc.mode ?? 'sandbox'),
      );
      if (!scene) throw new ArgError(`No scene opens room ${sc.roomId} in ${sc.mode ?? 'sandbox'} mode`);
      await page.goto(`http://127.0.0.1:${port}/?scene=${scene.id}&seed=${SEED}&paused=1`);
      await page.waitForFunction(() => window.__runeloom?.ready === true, undefined, { timeout: 30_000 });
      await page.evaluate(
        async ({ id, n }) => {
          const mod = await import('/src/sim/scenarios.ts' as string);
          const s = mod.scenarios.find((x: { id: string }) => x.id === id);
          const session = window.__runeloom!.session;
          s.setup?.(session.state);
          for (let i = 0; i < n; i++) session.step(s.input(session.state.tick, session.state));
        },
        { id: sc.id, n: ticks },
      );
      await page.evaluate(
        () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
      );
      const file = join(SHOTS_DIR, `${milestone}_scenario_${sc.id}_${ticks}.png`);
      await page.screenshot({ path: file, timeout: 120_000 });
      written.push(file);
      if (errors.length) console.warn(`warning: page errors in scenario ${sc.id}: ${errors.join('; ')}`);
    } else if (a.set === 'spells') {
      const only = (a.shot?.split(',') ?? [...spellShotIds]) as SpellShotId[];
      for (const id of only)
        if (!spellShotIds.includes(id))
          throw new ArgError(`Unknown spell shot "${id}". Available: ${spellShotIds.join(', ')}`);
      const at = ticks > 0 ? [ticks] : SPELL_SHOT_TICKS;
      const url = `http://127.0.0.1:${port}/?scene=adventure&seed=${SEED}&paused=1`;
      written.push(...(await spellShotSet(page, url, SHOTS_DIR, milestone, only, at)));
      if (errors.length) console.warn(`warning: page errors in spell shots: ${errors.join('; ')}`);
    } else if (a.set !== undefined)
      throw new ArgError(
        `Unknown --set "${a.set}". Available: creature, rooms, hearth, onload, ui, gallery, item, fight, fen, spells`,
      );
    for (const scene of a.set === undefined && a.scenario === undefined ? selected : []) {
      errors.length = 0;
      await page.goto(`http://127.0.0.1:${port}/?scene=${scene.id}&seed=${SEED}&paused=1`);
      await page.waitForFunction(() => window.__runeloom?.ready === true, undefined, { timeout: 30_000 });
      if (ticks > 0) {
        const scenario = scenarios.find((s) => s.roomId === scene.roomId);
        const frames = scenario
          ? scenarioFrames(scenario.id, SEED, ticks)
          : Array.from({ length: ticks }, () => ({ moveX: 0, moveY: 0, aimX: 0, aimY: 0, buttons: 0 }));
        await page.evaluate((fs) => {
          const s = window.__runeloom!.session;
          for (const f of fs) s.step(f);
        }, frames);
      }
      // Let the renderer draw the new state.
      await page.evaluate(
        () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
      );
      const file = join(SHOTS_DIR, `${milestone}_${scene.id}.png`);
      await page.screenshot({ path: file });
      written.push(file);
      if (errors.length) console.warn(`warning: page errors in scene ${scene.id}: ${errors.join('; ')}`);
    }
  } finally {
    await browser?.close().catch(() => {});
    await server?.close().catch(() => {});
  }
  for (const f of written) console.log(relative(process.cwd(), f));
});
