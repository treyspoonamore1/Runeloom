import { describe, expect, it } from 'vitest';
import { STATION_IDS } from '../../data/hearth';
import {
  affordFrac,
  countUp,
  countUpMs,
  expeditionRows,
  fmtAway,
  fmtCompact,
  fmtDuration,
  fmtNum,
  fmtRate,
  HEARTH_TABS,
  nextPlotLevel,
  offlineLines,
  rewardText,
  sendOptions,
  tabAttention,
  tabForStation,
} from '../../src/ui/hearth/hearthModel';

describe('Hearth tabs and stations', () => {
  it('every station opens a sub-tab that exists', () => {
    const tabs = HEARTH_TABS.map((t) => t.id);
    for (const s of STATION_IDS) expect(tabs).toContain(tabForStation(s));
  });

  it('routes each station to its screen', () => {
    expect(tabForStation('spindlewright')).toBe('spindlewright');
    expect(tabForStation('runekeeper')).toBe('garden');
    expect(tabForStation('rune_garden')).toBe('garden');
    expect(tabForStation('expedition_board')).toBe('expeditions');
    expect(tabForStation('kindling_pit')).toBe('buildings');
    expect(tabForStation('salvage_loom')).toBe('salvage');
    expect(tabForStation('hearth_fire')).toBe('rekindle');
    expect(tabForStation('cartographer')).toBe('cartographer');
  });

  it('marks the Expeditions tab only while something is ready', () => {
    expect(tabAttention(0)).toEqual({});
    expect(tabAttention(2)).toEqual({ expeditions: 2 });
  });
});

describe('formatting', () => {
  it('formats durations, rounding countdowns up', () => {
    expect(fmtDuration(0)).toBe('0s');
    expect(fmtDuration(0.2)).toBe('1s');
    expect(fmtDuration(45)).toBe('45s');
    expect(fmtDuration(570)).toBe('9m 30s');
    expect(fmtDuration(3600)).toBe('1h 00m');
    expect(fmtDuration(3600 + 125)).toBe('1h 02m');
    expect(fmtDuration(-4)).toBe('0s');
  });

  it('says how long the player was away', () => {
    expect(fmtAway(30)).toBe('1 minute');
    expect(fmtAway(45 * 60)).toBe('45 minutes');
    expect(fmtAway(3600)).toBe('1 hour');
    expect(fmtAway(3 * 3600 + 12 * 60)).toBe('3 hours 12 minutes');
    expect(fmtAway(8 * 3600)).toBe('8 hours');
  });

  it('formats numbers and rates', () => {
    expect(fmtNum(12345.6)).toBe('12,346');
    expect(fmtCompact(999)).toBe('999');
    expect(fmtCompact(1234)).toBe('1,234');
    expect(fmtCompact(12500)).toBe('12.5k');
    expect(fmtCompact(3_400_000)).toBe('3.4M');
    expect(fmtRate(2.44, 'Thread Scrap')).toBe('2.4 Thread Scrap a minute');
    expect(fmtRate(41.6, 'XP')).toBe('42 XP a minute');
  });
});

describe('count-up', () => {
  it('starts at the old value, ends exactly at the new one, and rises in between', () => {
    expect(countUp(100, 160, 0)).toBe(100);
    expect(countUp(100, 160, 1)).toBe(160);
    expect(countUp(100, 160, 2)).toBe(160);
    const mid = countUp(100, 160, 0.4);
    expect(mid).toBeGreaterThan(100);
    expect(mid).toBeLessThan(160);
    let last = 100;
    for (let t = 0; t <= 1.0001; t += 0.1) {
      const v = countUp(100, 160, t);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
  });

  it('counts down as well and keeps whole numbers', () => {
    expect(countUp(500, 120, 1)).toBe(120);
    const v = countUp(500, 120, 0.3);
    expect(Number.isInteger(v)).toBe(true);
    expect(v).toBeLessThan(500);
    expect(v).toBeGreaterThan(120);
  });

  it('takes longer for bigger jumps, within bounds', () => {
    expect(countUpMs(0, 1)).toBeGreaterThanOrEqual(250);
    expect(countUpMs(0, 10)).toBeLessThan(countUpMs(0, 100000));
    expect(countUpMs(0, 1e12)).toBeLessThanOrEqual(900);
  });
});

describe('expeditions', () => {
  it('lists returned ones first, then the soonest back, with progress and text', () => {
    const rows = expeditionRows([
      { uid: 1, tier: 3, left: 412, duration: 960, cycle: 0 },
      { uid: 2, tier: 2, left: 0, duration: 840, cycle: 0 },
      { uid: 3, tier: 1, left: 60, duration: 720, cycle: 0 },
    ]);
    expect(rows.map((r) => r.uid)).toEqual([2, 3, 1]);
    expect(rows[0]).toMatchObject({ ready: true, frac: 1, text: 'Back: ready to collect' });
    expect(rows[2]!.frac).toBeCloseTo(1 - 412 / 960);
    expect(rows[2]!.text).toBe('6m 52s left');
    expect(rows[1]!.ready).toBe(false);
    expect(rows.map((r) => r.cycle)).toEqual([0, 0, 0]);
  });

  it('survives a zero duration', () => {
    expect(expeditionRows([{ uid: 1, tier: 1, left: 5, duration: 0, cycle: 0 }])[0]!.frac).toBe(1);
  });

  it('offers tiers 1 up to the best, at least tier 1, with their durations', () => {
    const secs = (t: number) => 600 + 120 * t;
    expect(sendOptions(0, secs)).toEqual([{ tier: 1, text: '12m 00s' }]);
    expect(sendOptions(3, secs).map((o) => o.tier)).toEqual([1, 2, 3]);
    expect(sendOptions(3, secs)[2]!.text).toBe('16m 00s');
  });
});

describe('upgrade progress and plots', () => {
  it('shows how close the Embers are to a cost', () => {
    expect(affordFrac(50, 100)).toBe(0.5);
    expect(affordFrac(500, 100)).toBe(1);
    expect(affordFrac(0, 100)).toBe(0);
    expect(affordFrac(10, null)).toBe(1);
  });

  it('finds the Rune Garden level that adds a plot', () => {
    expect(nextPlotLevel(1)).toBe(4);
    expect(nextPlotLevel(5)).toBe(8);
    expect(nextPlotLevel(20)).toBeNull();
  });
});

describe('the offline summary', () => {
  it('lists only what happened', () => {
    expect(
      offlineLines({ seconds: 3600, scrap: 0, runeXp: 0, runeLevels: 0, expeditionsReturned: 0 }),
    ).toEqual([]);
    const lines = offlineLines({
      seconds: 3600,
      scrap: 214,
      runeXp: 5120,
      runeLevels: 3,
      expeditionsReturned: 2,
    });
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('+214 Thread Scrap');
    expect(lines[1]).toContain('+5,120 rune XP');
    expect(lines[1]).toContain('3 levels gained');
    expect(lines[2]).toContain('2 expeditions came back');
  });

  it('uses the singular', () => {
    const l = offlineLines({ seconds: 99, scrap: 1, runeXp: 40, runeLevels: 1, expeditionsReturned: 1 });
    expect(l[1]).toContain('1 level gained');
    expect(l[2]).toContain('1 expedition came back: collect it');
  });
});

describe('expedition rewards', () => {
  it('reads as a list', () => {
    expect(rewardText({ parts: 1, currency: 2, embers: 1450 })).toBe('1 Fuse part, 2 currency, 1,450 Embers');
    expect(rewardText({ parts: 3, currency: 1, embers: 45 })).toBe('3 Fuse parts, 1 currency, 45 Embers');
    expect(rewardText({ parts: 1, currency: 1, embers: 15, sigils: 1 })).toBe(
      '1 Fuse part, 1 currency, 1 Rift Sigil, 15 Embers',
    );
  });
});
