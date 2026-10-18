import { describe, expect, it } from 'vitest';
import { isBlockedByShield, step, type GameState } from '../../../src/sim';
import { addEnemy, arena, ofType } from '../combat/helpers';

const STILL = { moveX: 0, moveY: 0, aimX: 0, aimY: 0, buttons: 0 };

/** Steps n ticks with the player standing still; returns every event. */
function idle(state: GameState, n: number) {
  const all = [];
  for (let i = 0; i < n; i++) {
    step(state, STILL);
    all.push(...state.events);
  }
  return all;
}

function distToPlayer(state: GameState, x: number, y: number): number {
  return Math.hypot(x - state.player.x, y - state.player.y);
}

describe('Tinderling swarm', () => {
  it('a pack aggroes, reaches the player from several sides and nips', () => {
    const state = arena(true);
    state.cheats.god = true;
    const pack = Array.from({ length: 8 }, (_, i) =>
      addEnemy(state, 'tinderling', 115 + (i % 3) * 2.5, 54 + Math.floor(i / 3) * 2.5),
    );
    const events = idle(state, 4 * 60);
    expect(pack.every((e) => e.ai.targetId === 0)).toBe(true);
    for (const e of pack) expect(distToPlayer(state, e.x, e.y)).toBeLessThan(6);
    // Mean resultant length of the directions from the player: about 1 for a single file from
    // one side, 0 for an even ring. The offsets fan the pack out around the player's front.
    expect(new Set(pack.map((e) => `${Math.round(e.x)},${Math.round(e.y)}`)).size).toBe(pack.length);
    let sx = 0;
    let sy = 0;
    for (const e of pack) {
      const d = distToPlayer(state, e.x, e.y);
      sx += (e.x - state.player.x) / d;
      sy += (e.y - state.player.y) / d;
    }
    expect(Math.hypot(sx, sy) / pack.length).toBeLessThan(0.75);
    expect(ofType(events, 'telegraph').filter((t) => t.attack === 'nip').length).toBeGreaterThan(4);
    expect(ofType(events, 'hit').some((h) => h.target === 'player')).toBe(true);
  });

  it('stays idle out of aggro range, and stands still while winding up', () => {
    const state = arena(true);
    const far = addEnemy(state, 'tinderling', 150, 110);
    idle(state, 60);
    expect(far.ai.mode).toBe('idle');
    expect([far.x, far.y]).toEqual([150, 110]);

    const near = addEnemy(state, 'tinderling', 84, 60);
    let sawWindup = false;
    for (let i = 0; i < 60; i++) {
      step(state, STILL);
      if (near.attack.phase === 'windup') {
        sawWindup = true;
        expect([near.vx, near.vy]).toEqual([0, 0]);
        expect(near.ai.mode).toBe('windup');
      }
    }
    expect(sawWindup).toBe(true);
  });
});

describe('Ember Archer', () => {
  it('backs off to its band, holds it with line of sight and fires every ~1.4 s', () => {
    const state = arena(true);
    state.cheats.god = true;
    const a = addEnemy(state, 'ember_archer', 90, 60);
    const band = { min: 20, max: 30 };
    idle(state, 2 * 60);
    expect(distToPlayer(state, a.x, a.y)).toBeGreaterThan(band.min - 1);
    let inBand = 0;
    const samples = 10 * 60;
    let shots = 0;
    for (let i = 0; i < samples; i++) {
      step(state, STILL);
      const d = distToPlayer(state, a.x, a.y);
      if (d >= band.min - 2 && d <= band.max + 2) inBand++;
      shots += ofType(state.events, 'attack').filter((e) => e.attack === 'fire_arrow').length;
    }
    expect(inBand / samples).toBeGreaterThan(0.9);
    // 1.4 s cooldown plus up to 0.2 s jitter: 6 to 8 shots in 10 s.
    expect(shots).toBeGreaterThanOrEqual(6);
    expect(shots).toBeLessThanOrEqual(8);
  });

  it('closes in from beyond its band', () => {
    const state = arena(true);
    const a = addEnemy(state, 'ember_archer', 118, 60);
    idle(state, 30);
    expect(a.ai.mode).not.toBe('idle');
    idle(state, 2 * 60);
    expect(distToPlayer(state, a.x, a.y)).toBeLessThanOrEqual(32);
  });

  it('keeps its distance from a player walking at it', () => {
    const state = arena(true);
    state.cheats.god = true;
    const a = addEnemy(state, 'ember_archer', 105, 60);
    idle(state, 30);
    let minD = Infinity;
    for (let i = 0; i < 2 * 60; i++) {
      const dx = a.x - state.player.x;
      const dy = a.y - state.player.y;
      const d = Math.hypot(dx, dy);
      // Walk toward it at 40% speed (10 cells/s, under its 16).
      step(state, { moveX: (0.4 * dx) / d, moveY: (0.4 * dy) / d, aimX: a.x, aimY: a.y, buttons: 0 });
      minD = Math.min(minD, distToPlayer(state, a.x, a.y));
    }
    expect(minD).toBeGreaterThan(7); // panicRange 8, minus a tick of closing
  });
});

describe('Shieldbearer', () => {
  /** Circles the Shieldbearer at `radius` with move magnitude `speed`; counts ticks behind its shield. */
  function circle(radius: number, speed: number, seconds: number) {
    const state = arena(true);
    state.cheats.god = true;
    const s = addEnemy(state, 'shieldbearer', 80 + radius, 60);
    let exposed = 0;
    for (let i = 0; i < seconds * 60; i++) {
      const p = state.player;
      const dx = p.x - s.x;
      const dy = p.y - s.y;
      const d = Math.hypot(dx, dy);
      // Tangent (counterclockwise) plus a radial correction toward `radius`.
      const k = (radius - d) * 0.3;
      step(state, {
        moveX: speed * (-dy / d) + (k * dx) / d,
        moveY: speed * (dx / d) + (k * dy) / d,
        aimX: s.x,
        aimY: s.y,
        buttons: 0,
      });
      if (i > 60 && !isBlockedByShield(s, state.player.x, state.player.y)) exposed++;
    }
    return { exposed, s };
  }

  it('turns at a limited rate, so a player circling fast gets behind the shield', () => {
    const fast = circle(8, 1, 6);
    expect(fast.exposed).toBeGreaterThan(60);
    const slow = circle(8, 0.1, 6);
    expect(slow.exposed).toBeLessThan(fast.exposed / 4);
  });

  it('bashes only when the player is in front, and keeps its facing through the windup', () => {
    const state = arena(true);
    state.cheats.god = true;
    // Facing away from the player (+x), the player 5 cells behind it on the -x side.
    const s = addEnemy(state, 'shieldbearer', 85, 60, [1, 0]);
    s.ai.cooldown = 0;
    step(state, STILL);
    expect(s.attack.phase).toBe('none');
    const events: ReturnType<typeof idle> = [];
    let firstBash: [number, number] | null = null;
    let locked: [number, number] | null = null;
    for (let i = 0; i < 4 * 60; i++) {
      step(state, STILL);
      events.push(...state.events);
      if (s.attack.phase === 'windup') {
        locked ??= [s.facingX, s.facingY];
        firstBash ??= locked;
        expect([s.facingX, s.facingY]).toEqual(locked);
      } else {
        locked = null;
      }
    }
    const bash = ofType(events, 'telegraph').filter((t) => t.attack === 'shield_bash');
    expect(bash.length).toBeGreaterThan(0);
    // It had to turn to face the player (within the bash arc) before the first bash.
    expect(firstBash![0]).toBeLessThan(-0.8 + 1e-9);
    expect(ofType(events, 'hit').some((h) => h.target === 'player')).toBe(true);
  });
});
