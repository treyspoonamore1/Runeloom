import { signal } from '@preact/signals';
import { hashHex, hashState } from '../sim';
import type { DebugContext } from './debug';
import type { FrameStats } from '../app/loop';

interface Snapshot {
  fps: number;
  frameMs: number;
  simMs: number;
  tick: number;
  x: number;
  y: number;
  charges: number;
  hash: string;
  paused: boolean;
  timescale: number;
}

/** Updates the numbers at 4 Hz and the hash at 2 Hz so the overlay stays readable and cheap. */
export function createStats(ctx: DebugContext) {
  const snap = signal<Snapshot | null>(null);
  let lastUi = -Infinity;
  let lastHash = -Infinity;
  let hash = '';
  return {
    snap,
    update(s: FrameStats): void {
      const now = performance.now();
      if (now - lastUi < 250) return;
      lastUi = now;
      const st = ctx.session.state;
      if (now - lastHash >= 500) {
        lastHash = now;
        hash = hashHex(hashState(st));
      }
      snap.value = {
        fps: s.fps,
        frameMs: s.frameMs,
        simMs: s.simMs,
        tick: st.tick,
        x: st.player.x,
        y: st.player.y,
        charges: st.player.dodgeCharges,
        hash,
        paused: ctx.loop.paused,
        timescale: ctx.loop.timescale,
      };
    },
  };
}

function Row(p: { k: string; v: string; dim?: boolean }) {
  return (
    <div class={p.dim ? 'dbg-row dim' : 'dbg-row'}>
      <span>{p.k}</span>
      <b>{p.v}</b>
    </div>
  );
}

export function StatsOverlay(p: {
  snap: ReturnType<typeof createStats>['snap'];
  visible: { value: boolean };
}) {
  const s = p.snap.value;
  if (!p.visible.value || !s) return null;
  const mode = s.paused ? 'PAUSED' : s.timescale !== 1 ? `x${s.timescale}` : '';
  return (
    <div class="dbg-panel dbg-stats">
      <h4>Stats (F3){mode ? ` - ${mode}` : ''}</h4>
      <Row k="fps" v={s.fps.toFixed(0)} />
      <Row k="frame ms" v={s.frameMs.toFixed(1)} />
      <Row k="sim ms/tick" v={s.simMs.toFixed(3)} />
      <Row k="tick" v={String(s.tick)} />
      <Row k="player" v={`${s.x.toFixed(1)}, ${s.y.toFixed(1)}`} />
      <Row k="dodges" v={String(s.charges)} />
      <Row k="hash" v={s.hash} />
      <Row k="grid ms" v="—" dim />
      <Row k="spells" v="—" dim />
      <Row k="dropped" v="—" dim />
    </div>
  );
}
