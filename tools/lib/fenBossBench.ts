/**
 * M8: the entity bench in the Glasswater Coil's fight (the bosses agent's acceptance, DESIGN §12
 * entity budget): the boss bot (src/sim/bots/fenBossBot.ts, the tier 8 reference with Floodline on
 * Q) in test/boss_coil against the Coil held in phase 3, its busiest: Body pulses every 4 s over its
 * water, the pylon storm every 6 s, the bot's Tide strips, spits and their puddles, its own route
 * planning through the Eye. God mode; the Coil's life is topped back up to 30% so the fight never
 * ends. The whole step is timed, the bot's input and the grid tick included.
 */
import { setupFenBossFight } from '../../src/sim/bots/fenBossBot';
import { CampaignNav } from '../../src/sim/bots/campaignNav';
import { step } from '../../src/sim';
import { loadAllRooms } from './rooms';

export function coilFightSetup(): () => void {
  const { state, boss } = setupFenBossFight({
    rooms: loadAllRooms(),
    roomId: 'test/boss_coil',
    seed: 1,
    tide: 'tide',
    start: { x: 62, y: 88 },
  });
  state.cheats.god = true;
  boss.life = boss.maxLife * 0.3;
  const nav = new CampaignNav();
  return () => {
    if (boss.life < boss.maxLife * 0.1) boss.life = boss.maxLife * 0.3;
    step(state, nav.input(state));
  };
}
