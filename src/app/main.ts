import { findScenario, hashHex, hashState, runScenario } from '../sim';
import { createRenderer } from '../render/renderer';
import { createDebugUI } from '../ui/debug';
import { GameLoop } from './loop';
import { InputSampler } from './input';
import { Session } from './session';
import { DEFAULT_SCENE, findScene } from './scenes';
import { roomText } from './rooms';
import { installDebugHandle } from './debugHandle';
import { createAudio } from '../audio/audio';
import { createHud } from '../ui/hud';

async function boot(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const scene = findScene(params.get('scene') ?? DEFAULT_SCENE) ?? findScene(DEFAULT_SCENE)!;
  const seed = Number(params.get('seed') ?? 1) >>> 0;

  const gameEl = document.getElementById('game')!;
  const uiRoot = document.getElementById('ui')!;
  const session = new Session({ seed, roomId: scene.roomId, sceneId: scene.id, mode: scene.mode });
  const renderer = await createRenderer(gameEl, session.state);
  session.onReset((s) => renderer.setRoom(s));
  const input = new InputSampler(renderer.app.canvas);
  renderer.app.canvas.addEventListener('mousemove', (e) => renderer.setCursor(e.offsetX, e.offsetY));

  const loop = new GameLoop({
    sampleInput: () => input.sample((sx, sy) => renderer.screenToWorld(sx, sy)),
    step: (f) => session.step(f),
    render: (alpha, dt) => {
      // Every sim event since the last frame goes to render, audio and HUD exactly once.
      const events = session.drainEvents();
      renderer.handleEvents(events);
      audio.handleEvents(events, session.state);
      hud.handleEvents(events);
      renderer.render(session.state, alpha, dt);
    },
    onFrame: (stats) => {
      hud.frame(session.state);
      debug.frame(stats);
    },
  });
  const audio = createAudio();
  const hud = createHud({ session, loop, input, uiRoot, audio });
  const debug = createDebugUI({ session, loop, renderer, input, uiRoot });

  if (params.get('paused') === '1') loop.paused = true;
  loop.start();

  installDebugHandle({
    session,
    loop,
    renderer,
    stateHash: () => hashHex(hashState(session.state)),
    runScenarioHash: (id, ticks, s) => {
      const sc = findScenario(id);
      if (!sc) throw new Error(`Unknown scenario ${id}`);
      return hashHex(runScenario(sc, roomText(sc.roomId), { seed: s, ticks }).hash);
    },
  });
}

void boot();
