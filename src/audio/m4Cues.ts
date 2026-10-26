import type { M4SfxId } from '../../data/sfxM4';
import type { M4Cue } from '../app/m4Signals';
import { filterAction } from '../app/lootFilterStore';
import type { M4AttackKey } from '../app/m4Wiring';

/** An M4 sound to play (same shape as cues.ts Cue, over data/sfxM4.ts ids). */
export interface M4SoundCue {
  id: M4SfxId;
  x?: number;
  y?: number;
  gain?: number;
}

const WINDUP: Partial<Record<M4AttackKey, M4SfxId>> = {
  lurkerLunge: 'lurkerRipple',
  hulkSlam: 'slamGrunt',
  matriarchSlam: 'slamGrunt',
  wispFrostLine: 'frostLineCharge',
  stormStrike: 'stormCharge',
  tarGlob: 'tarGloop',
  tarRush: 'chargeRoar',
  summon: 'summonGurgle',
  wardenCharge: 'chargeRoar',
  fireSlam: 'fireWhoosh',
  fireBreath: 'fireWhoosh',
  brazierStorm: 'stormBuild',
  // M8 Drowned Foundry bosses (data/sfxFenBosses.ts): the toll, the self-toll, a stranded thrash.
  tollRing: 'bellToll',
  tollFoundry: 'bellToll',
  selfToll: 'bellSelfToll',
  tailThrash: 'coilThrash',
  coilLunge: 'lurkerRipple',
};

const LANDED: Partial<Record<M4AttackKey, M4SfxId>> = {
  lurkerLunge: 'lurkerSplash',
  hulkSlam: 'slamImpact',
  matriarchSlam: 'slamImpact',
  fireSlam: 'slamImpact',
  stormStrike: 'thunder',
  brazierStorm: 'thunder',
  tarGlob: 'tarGloop',
};

const at = (id: M4SfxId, c: { x: number; y: number }, gain?: number): M4SoundCue =>
  gain === undefined ? { id, x: c.x, y: c.y } : { id, x: c.x, y: c.y, gain };

/**
 * Sounds for one M4 cue (src/app/m4Signals.ts). Pure. World sounds are positional; level ups,
 * room changes and boss stings are centered.
 */
export function m4Sounds(c: M4Cue): M4SoundCue[] {
  switch (c.type) {
    case 'doorOpened':
      if (c.kind === 'big_key_door') return [at('bigDoorOpen', c)];
      return c.kind === 'locked_door' ? [at('doorUnlock', c), at('doorOpen', c)] : [at('doorOpen', c)];
    case 'chestOpened':
      return [at('chestOpen', c)];
    case 'pickup':
      return [at(c.kind === 'heart_seed' ? 'pickupHeart' : 'pickupShard', c)];
    case 'loomStoneActivated':
      return [at('loomStone', c)];
    case 'plateClick':
      return [at(c.pressed ? 'plateClick' : 'plateRelease', c)];
    case 'switchPowered':
      return [at(c.on ? 'switchOn' : 'switchOff', c)];
    case 'blockMoved':
      if (c.stopped) return [at('blockStop', c)];
      return [at(c.sliding ? 'iceSlide' : 'blockPush', c)];
    case 'brazierLit':
      return [at(c.lit ? 'brazierLit' : 'brazierOut', c)];
    case 'lootDropped': {
      // The loot filter (app/lootFilterStore.ts): hidden drops are silent, highlighted ones chime like a Rare.
      const act = c.content ? filterAction(c.content) : 'show';
      // Embers (M7) drop by the dozen: silent on the floor.
      if (act === 'hide' || c.content?.kind === 'embers') return [];
      const r = c.content?.kind === 'item' ? c.content.item.rarity : 'normal';
      if (r === 'unique') return [at('lootDropUnique', c)];
      return [at(r === 'rare' || act === 'highlight' ? 'lootDropRare' : 'lootDrop', c)];
    }
    case 'lootPicked':
      if (c.content && filterAction(c.content) === 'hide') return [];
      if (c.content?.kind === 'embers') return [{ id: 'emberPickup' }];
      return [{ id: c.content?.kind === 'rune' ? 'runePickup' : 'lootPickup' }];
    case 'levelUp':
      return [{ id: 'levelUp' }];
    case 'roomEnter':
      return [{ id: 'roomEnter' }];
    case 'bossAppear':
      return [{ id: 'bossSting' }];
    case 'bossPhase':
      return [{ id: 'bossPhase' }];
    case 'bossDeath':
      return [{ id: 'bossDeath' }];
    case 'superheatChanged':
      return [at(c.on ? 'superheatOn' : 'superheatOff', c)];
    case 'flood':
      return [{ id: 'flood' }];
    case 'kilnSpawn':
      return [at('kilnHatch', c)];
    case 'hulkFuse':
      return [at('fuseSizzle', c)];
    case 'attackWindup': {
      const id = WINDUP[c.attack];
      return id ? [at(id, c)] : [];
    }
    case 'attackLanded': {
      const id = LANDED[c.attack];
      return id ? [at(id, c)] : [];
    }
    case 'playerRespawn':
      return [{ id: 'respawnLoom' }];
    default:
      return [];
  }
}
