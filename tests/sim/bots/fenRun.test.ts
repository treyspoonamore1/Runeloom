/**
 * BUILD_PLAN M8 phase 1 acceptance "Campaign bot" and "Pacing": from the "Fen start" save
 * (data/playtest/fen_start.json) the Fen campaign bot (bots/fenRun.ts) walks G1 to F10, solving
 * every puzzle with the scripted solutions, without dying; the Bellwether falls in 60–100 s and the
 * Coil in 120–180 s with Tide strands; the Fen takes 50–70 minutes at human pacing. The full report
 * is `npm run sim -- --fen`.
 */
import { describe, expect, it } from 'vitest';
import { fenReport } from '../../../tools/lib/fenCli';

describe('Fen campaign bot', () => {
  it('clears G1 to F10 from the Fen start save without dying, on target', () => {
    const r = fenReport({ seed: 1 });
    const { run } = r;
    expect(run.failedSteps).toEqual([]);
    expect(run.deaths).toBe(0);
    expect(run.coilDead).toBe(true);
    expect(run.visits.map((v) => v.label)).toContain('f10');
    expect(run.visits.every((v) => v.left.length === 0)).toBe(true);
    expect(run.bellwetherSeconds).toBeGreaterThanOrEqual(60);
    expect(run.bellwetherSeconds).toBeLessThanOrEqual(100);
    expect(run.coilSeconds).toBeGreaterThanOrEqual(120);
    expect(run.coilSeconds).toBeLessThanOrEqual(180);
    expect(r.pacingMinutes).toBeGreaterThanOrEqual(50);
    expect(r.pacingMinutes).toBeLessThanOrEqual(70);
    // The no-Tide comparison: the same character from F10's door, clearly slower without Tide.
    expect(r.coilTide!.killed).toBe(true);
    expect(r.coilTide!.strands).toBeGreaterThanOrEqual(2);
    expect(r.coilNoTide!.strands).toBe(0);
    expect(r.coilNoTide!.seconds).toBeGreaterThanOrEqual(2 * r.coilTide!.seconds);
  }, 300_000);
});
