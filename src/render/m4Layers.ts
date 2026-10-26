import { Container } from 'pixi.js';
import type { GameState, SimEvent } from '../sim';
import { M4Signals } from '../app/m4Signals';
import type { Atlas, AtlasEntry } from './atlas';
import { BeastTelegraphs, telegraphAccentEntries } from './bestiary/beastTelegraphs';
import { bigBeastEntries } from './bestiary/bigBeasts';
import { RarityView, rarityAtlasEntries } from './bestiary/rarityView';
import { smallBeastEntries } from './bestiary/smallBeasts';
import { fenShapesA } from './bestiary/fenShapesA';
import { fenShapesB } from './bestiary/fenShapesB';
import { FenTelegraphs, fenTelegraphEntries } from './bestiary/fenTelegraphs';
import { fenIconEntries } from './bestiary/fenIcons';
import type { EnemyLayer } from './enemyLayer';
import { objectAtlasEntries } from './world/objectShapes';
import { fenObjectAtlasEntries } from './world/fenObjectShapes';
import { objectCue } from './world/objectCues';
import { ObjectView, ownedTiles } from './world/objectView';
import { WorldFx } from './world/worldFx';
import { lootAtlasEntries } from './world/lootShapes';
import { runeAtlasEntries } from './world/runeShapes';
import { LootView } from './world/lootView';
import { MomentsView } from './world/momentsView';
import { RuneGetView } from './world/runeGetView';
import type { Shake } from './shake';
import { HubView } from './hub/hubView';

/** Atlas entries of everything M4 adds. */
export function m4AtlasEntries(): AtlasEntry[] {
  return [
    ...smallBeastEntries(),
    ...bigBeastEntries(),
    ...fenShapesA(),
    ...fenShapesB(),
    ...rarityAtlasEntries(),
    ...telegraphAccentEntries(),
    ...fenTelegraphEntries(),
    ...fenIconEntries(),
    ...objectAtlasEntries(),
    ...fenObjectAtlasEntries(),
    ...lootAtlasEntries(),
    ...runeAtlasEntries(),
  ];
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
  readonly fx: WorldFx;
  readonly objects: ObjectView;
  readonly loot: LootView;
  readonly moments: MomentsView;
  /** The hero holding a new element rune overhead (the HUD's item-get panel drives it). */
  readonly runeGet: RuneGetView;
  /** The Hearth's hub (M7): NPCs, the fire, buildings by level, the station prompt. */
  readonly hub: HubView;
  /** Ground layer under the bodies (rarity rings and glows). */
  readonly ground = new Container();
  /** Screen-space layer under damage numbers (Rare name plates). */
  readonly screen = new Container();
  private state: GameState | null = null;

  constructor(atlas: Atlas, enemies: EnemyLayer, shake: Shake | null) {
    enemies.signals = this.signals;
    this.rarity = new RarityView(atlas);
    this.tele = new FenTelegraphs(atlas);
    this.fx = new WorldFx(atlas);
    this.objects = new ObjectView(atlas, this.fx);
    this.loot = new LootView(atlas, this.fx);
    this.moments = new MomentsView(this.fx, shake);
    this.runeGet = new RuneGetView(atlas, this.fx);
    this.hub = new HubView(atlas, this.fx, this.objects.root);
    this.fx.over.addChild(this.hub.top);
    this.ground.addChild(this.rarity.glows.container, this.rarity.ground.container);
    this.screen.addChild(this.rarity.plates, this.moments.screen);
  }

  reset(s: GameState): void {
    this.state = s;
    this.tele.reset();
    this.objects.reset();
    this.loot.reset();
    this.fx.reset();
    this.moments.reset();
    this.runeGet.reset();
    this.hub.reset();
  }

  /** Tiles the object layer draws, so the room bake leaves them out. */
  owned(s: GameState): Set<number> {
    return ownedTiles(s.objects, s.room.tilesW);
  }

  handle(s: GameState, events: readonly SimEvent[], dt: number): void {
    this.state = s;
    this.hub.handle(events);
    const cues = this.signals.update(s, events, dt);
    this.tele.handle(cues, s);
    for (const c of cues) {
      objectCue(c, this.fx);
      this.loot.handle(c, s);
      this.moments.handle(c, s);
    }
  }

  update(
    s: GameState,
    enemies: EnemyLayer,
    dt: number,
    xf: ScreenXf,
    screenW: number,
    screenH: number,
    px: number,
    py: number,
  ): void {
    this.state = s;
    this.loot.update(s, dt);
    this.moments.follow(px, py);
    this.moments.update(dt, screenW, screenH, xf.scale, xf.ox, xf.oy, xf.screenScale, s.player.dead);
    this.rarity.update(s, enemies, dt, xf);
    this.tele.update(s, this.signals, dt);
    this.objects.update(s, dt);
    this.hub.update(s, dt);
    this.fx.update(dt);
  }

  get particleCount(): number {
    return this.fx.count;
  }

  get current(): GameState | null {
    return this.state;
  }
}
