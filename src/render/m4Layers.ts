import { Container } from 'pixi.js';
import type { GameState, SimEvent } from '../sim';
import { M4Signals } from '../app/m4Signals';
import type { Atlas, AtlasEntry } from './atlas';
import { BeastTelegraphs, telegraphAccentEntries } from './bestiary/beastTelegraphs';
import { bigBeastEntries } from './bestiary/bigBeasts';
import { RarityView, rarityAtlasEntries } from './bestiary/rarityView';
import { smallBeastEntries } from './bestiary/smallBeasts';
import type { EnemyLayer } from './enemyLayer';

/** Atlas entries of everything M4 adds. */
export function m4AtlasEntries(): AtlasEntry[] {
  return [...smallBeastEntries(), ...bigBeastEntries(), ...rarityAtlasEntries(), ...telegraphAccentEntries()];
}

export interface ScreenXf {
  scale: number;
  ox: number;
  oy: number;
  screenScale: number;
}

/**
 * The M4 visuals in one place (DESIGN §14, §15): monster rarity, M4 telegraph accents, puzzle
 * objects, loot, transitions and moments. The renderer adds the containers in its layer order and
 * forwards events; this class turns them into cues once (M4Signals) and fans them out.
 */
export class M4Layers {
  readonly signals = new M4Signals();
  readonly rarity: RarityView;
  readonly tele: BeastTelegraphs;
  /** Ground layer under the bodies (rarity rings and glows). */
  readonly ground = new Container();
  /** Screen-space layer under damage numbers (Rare name plates). */
  readonly screen = new Container();
  private state: GameState | null = null;

  constructor(atlas: Atlas, enemies: EnemyLayer) {
    enemies.signals = this.signals;
    this.rarity = new RarityView(atlas);
    this.tele = new BeastTelegraphs(atlas);
    this.ground.addChild(this.rarity.glows.container, this.rarity.ground.container);
    this.screen.addChild(this.rarity.plates);
  }

  reset(s: GameState): void {
    this.state = s;
    this.tele.reset();
  }

  handle(s: GameState, events: readonly SimEvent[], dt: number): void {
    this.state = s;
    const cues = this.signals.update(s, events, dt);
    this.tele.handle(cues, s);
  }

  update(s: GameState, enemies: EnemyLayer, dt: number, xf: ScreenXf): void {
    this.state = s;
    this.rarity.update(s, enemies, dt, xf);
    this.tele.update(s, this.signals, dt);
  }

  get particleCount(): number {
    return 0;
  }

  get current(): GameState | null {
    return this.state;
  }
}
