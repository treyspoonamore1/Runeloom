/**
 * Screenshots of debug scenes into shots/.
 *   npm run shots [-- --scene room] [--milestone m0] [--ticks N] [--viewport 390x844]
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
    const port = await freePort();
    server = await createServer({
      root: ROOT,
      logLevel: 'error',
      server: { port, strictPort: true, host: '127.0.0.1' },
    });
    await server.listen();
    browser = await chromium.launch({ headless: true, args: GL_ARGS });
    const page = await browser.newPage({ viewport });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    for (const scene of selected) {
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
