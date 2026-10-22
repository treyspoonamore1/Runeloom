/** The M6 rift bench for tools/bench.ts (kept here so bench.ts stays small). */
import { performance } from 'node:perf_hooks';
import { step } from '../../src/sim';
import { applyHeroEdit } from '../../src/sim/hero/edits';
import { CampaignNav } from '../../src/sim/bots/campaignNav';
import { riftCharacter } from '../../src/sim/bots/riftBot';
import { applyReferenceBuild } from '../../src/sim/bots/campaignPlan';
import { createAdventure } from '../../src/sim/world/adventure';
import { touchLoomStone } from '../../src/sim/world/objectTouch';
import { generateRift } from '../../src/sim/world/rift/generate';
import { enterRoom } from '../../src/sim/world/transition';
import { roomFlags, type Edge } from '../../src/sim/world/worldState';
import { makeSigil } from '../../src/sim/items/sigils';
import { syncWeaveSpindle } from '../../src/sim/hero/equip';
import { refreshHero } from '../../src/sim/hero/hero';
import { startRoom } from '../../data/progression';
import { loadAllRooms } from './rooms';
import { summarize } from './stats';
import type { AdventureBench } from './adventureBench';

/**
 * M6: a tier 8 Teeming rift of Live Wires, Floodplain and the Tinderbox (more monsters, pylon
 * pulses, water everywhere, Oiled monsters on grass) cleared room by room by the campaign bot in
 * god mode. Report only, like the adventure tour: room-change ticks include the room load; the
 * note also gives the time to open the rift (generate its rooms).
 */
export function riftBench(budgetMs: number): AdventureBench {
  const loads: number[] = [];
  let openMs = 0;
  let measuring = false;
  return {
    id: 'entity:rift_bot',
    description: 'Rift: tier 8, Teeming, Live Wires, Floodplain, Tinderbox; bot clears room by room',
    budgetMs,
    reportOnly: true,
    onMeasureStart: () => {
      measuring = true;
      loads.length = 0;
    },
    note: () => {
      const l = loads.length ? summarize(loads) : null;
      return (
        `opening the rift ${openMs.toFixed(1)} ms; ` +
        (l
          ? `${loads.length} room change tick(s): mean ${l.mean.toFixed(3)} ms, max ${l.max.toFixed(3)} ms`
          : 'no room changes while measured')
      );
    },
    setup() {
      const rooms = loadAllRooms();
      const state = createAdventure({ seed: 1, rooms, hero: riftCharacter(8), startRoomId: startRoom });
      syncWeaveSpindle(state);
      refreshHero(state);
      applyReferenceBuild(state, { craft: false });
      touchLoomStone(
        state,
        state.objects.find((o) => o.kind === 'loom_stone')!,
      );
      const g = makeSigil(state.hero, 8, ['teeming', 'live_wires', 'floodplain', 'tinderbox']);
      state.hero.sigils.push(g);
      const t0 = performance.now();
      applyHeroEdit(state, { kind: 'openRift', uid: g.uid });
      openMs = performance.now() - t0;
      state.cheats.god = true;
      const plan = generateRift(state.world.rift!.spec, rooms).plan;
      let k = 0;
      let nav = new CampaignNav();
      return () => {
        const t1 = performance.now();
        const here = plan[k]!;
        if (roomFlags(state.world, here.id).cleared && k + 1 < plan.length) {
          const next = plan[++k]!;
          const parent = plan.slice(0, k).find((r) => Object.values(r.exits).includes(next.id))!;
          const edge = (Object.keys(parent.exits) as Edge[]).find((e) => parent.exits[e] === next.id)!;
          enterRoom(state, next.id, { kind: 'edge', from: edge });
          nav = new CampaignNav();
        } else step(state, nav.input(state));
        const ms = performance.now() - t1;
        if (measuring && state.events.some((e) => e.type === 'roomEnter')) loads.push(ms);
        return ms;
      };
    },
  };
}
