import { Container, Graphics, Sprite, type GraphicsContext } from 'pixi.js';
import { buildings, type BuildingId } from '../../../data/hearth';
import { getRune } from '../../../data/runes';
import type { GameState } from '../../sim';
import { gardenPlots } from '../../sim/meta/view';
import type { Atlas } from '../atlas';
import { rand } from '../ailmentBursts';
import { INK } from '../combatPalette';
import { PAL } from '../palette';
import { LOOT } from '../world/worldPalette';
import type { WorldFx } from '../world/worldFx';
import { buildingShape, buildingSpots, GARDEN_SOCKETS, type BuildingSpots, type Stage } from './buildingShapes';
import { HUB, HUB_FEEL as F } from './hubPalette';
import { ctx } from './hubShapes';
import { flameCtx, shapeGraphics, type StationBox, type StationView } from './stationViews';

const TAU = Math.PI * 2;

/** A building's look stage at a level: 0 unbuilt, then 1–4 at HUB_FEEL.stageAt of its max level. */
export function buildingStage(id: BuildingId, level: number): Stage {
  if (level <= 0) return 0;
  const max = buildings[id].maxLevel;
  let stage = 1;
  for (const f of F.stageAt) if (level >= Math.max(2, Math.ceil(max * f))) stage++;
  return Math.min(4, stage) as Stage;
}

let socketCtx: GraphicsContext | null = null;
let paperCtx: GraphicsContext | null = null;
let readyCtx: GraphicsContext | null = null;
let shuttleCtx: GraphicsContext | null = null;

function parts(): void {
  socketCtx ??= ctx((p) => {
    p.ellipse(0, 0.25, 0.85, 0.45).fill(HUB.soilDark).stroke(0.14, INK);
    p.ellipse(0, 0.15, 0.55, 0.25).fill({ color: 0x000000, alpha: 0.25 });
  });
  const paper = (ready: boolean) =>
    ctx((p) => {
      p.poly([-0.75, -0.8, 0.75, -0.9, 0.8, 0.85, -0.7, 0.9]).fill(HUB.cloth).stroke(0.14, INK);
      for (const y of [-0.3, 0.05, 0.4]) p.moveTo(-0.45, y).lineTo(0.45, y - 0.03).stroke(0.07, HUB.clothShade);
      if (ready) p.circle(0.35, 0.55, 0.3).fill(HUB.gold).stroke(0.1, INK);
      p.circle(0, -0.8, 0.2).fill(ready ? HUB.gold : 0xff4f7a).stroke(0.08, INK);
    });
  paperCtx ??= paper(false);
  readyCtx ??= paper(true);
  shuttleCtx ??= ctx((p) => {
    p.poly([-0.9, 0, -0.4, -0.3, 0.4, -0.3, 0.9, 0, 0.4, 0.3, -0.4, 0.3]).fill(HUB.woodLight).stroke(0.14, INK);
    p.rect(-0.25, -0.12, 0.5, 0.24).fill(0x9fb4ff);
  });
}

/**
 * A Hearth building drawn by its level (hero.hearth.buildings): the empty plot, then four
 * growing stages. The Kindling Pit burns, the Rune Garden shows its plots and planted runes, the
 * Expedition Board pins a note per expedition (ready ones glint), the Salvage Loom's shuttle runs.
 */
export class BuildingView implements StationView {
  readonly root = new Container();
  private readonly base: Graphics;
  private readonly extra = new Container();
  private stage: Stage | -1 = -1;
  private spots: BuildingSpots = { top: -3 };
  private flame: Graphics | null = null;
  private glow: Sprite | null = null;
  private shuttle: Graphics | null = null;
  private readonly sockets: Container[] = [];
  private readonly pins: Array<{ g: Graphics; ready: boolean; glow: Sprite }> = [];
  private key = '';

  constructor(
    private readonly atlas: Atlas,
    private readonly id: BuildingId,
    private readonly box: StationBox,
  ) {
    parts();
    this.root.position.set(box.cx, box.cy);
    this.base = shapeGraphics(buildingShape(id, 0), this.root);
    this.root.addChild(this.extra);
  }

  top(): number {
    return this.spots.top;
  }

  private build(stage: Stage): void {
    this.stage = stage;
    this.spots = buildingSpots(this.id, stage);
    this.base.context = buildingShape(this.id, stage);
    for (const c of this.extra.removeChildren()) c.destroy({ children: true });
    this.flame = this.glow = this.shuttle = null;
    this.sockets.length = 0;
    this.pins.length = 0;
    this.key = '';
    if (stage === 0) return;
    const f = this.spots.flame;
    if (f) {
      this.glow = new Sprite(this.atlas.get('glow'));
      this.glow.blendMode = 'add';
      this.glow.tint = PAL.flameOuter;
      this.glow.position.set(f.x, f.y - 0.6);
      this.flame = new Graphics(flameCtx());
      this.flame.position.set(f.x, f.y + 0.3);
      this.extra.addChild(this.glow, this.flame);
    }
    if (this.spots.shuttle) {
      this.shuttle = shapeGraphics(shuttleCtx!, this.extra);
    }
  }

  update(s: GameState, t: number, dt: number, fx: WorldFx): void {
    const h = s.hero.hearth;
    const level = h.buildings[this.id];
    const stage = buildingStage(this.id, level);
    if (stage !== this.stage) this.build(stage);
    if (stage === 0) return;
    if (this.flame && this.glow) {
      const n = 0.6 * Math.sin(t * 9.1) + 0.4 * Math.sin(t * 23.7 + 1.3);
      const sc = F.pitFlame[stage - 1]!;
      this.flame.scale.set(sc * (1 - 0.07 * n), sc * (1 + 0.16 * n));
      this.glow.scale.set(3 + stage * 0.6 + 0.3 * n);
      this.glow.alpha = 0.45 + 0.1 * n;
    }
    if (this.shuttle && this.spots.shuttle) {
      const sp = this.spots.shuttle;
      const u = 0.5 + 0.5 * Math.sin(t * 1.6);
      this.shuttle.position.set(sp.x0 + (sp.x1 - sp.x0) * u, sp.y);
    }
    if (this.id === 'rune_garden') this.garden(s, t, fx);
    if (this.id === 'expedition_board') this.board(s, t, dt, fx);
  }

  /** Plot sockets for the garden's level; planted runes as small glowing stones. */
  private garden(s: GameState, t: number, fx: WorldFx): void {
    const h = s.hero.hearth;
    const plots = Math.min(GARDEN_SOCKETS.length, gardenPlots(h.buildings.rune_garden));
    const runes = h.garden.map((u) => s.hero.runes.find((r) => r.uid === u)?.rune ?? '');
    const key = `${plots}|${runes.join(',')}`;
    if (key !== this.key) {
      this.key = key;
      for (const c of this.sockets) c.destroy({ children: true });
      this.sockets.length = 0;
      for (let i = 0; i < plots; i++) {
        const at = GARDEN_SOCKETS[i]!;
        const c = new Container();
        c.position.set(at.x, at.y);
        shapeGraphics(socketCtx!, c);
        const rune = runes[i];
        if (rune) {
          const kind = getRune(rune)?.kind ?? 'form';
          const color = LOOT.runeKind[kind];
          const glow = new Sprite(this.atlas.get('glow'));
          glow.blendMode = 'add';
          glow.tint = color;
          glow.label = 'glow';
          const stone = new Sprite(this.atlas.get('rune_stone'));
          stone.tint = color;
          stone.scale.set(0.62);
          stone.position.set(0, -0.35);
          const glyph = new Sprite(this.atlas.get(`glyph_${kind}`));
          glyph.tint = color;
          glyph.scale.set(0.62);
          glyph.position.set(0, -0.45);
          c.addChild(glow, stone, glyph);
        }
        this.extra.addChild(c);
        this.sockets.push(c);
      }
    }
    this.sockets.forEach((c, i) => {
      const g = c.getChildByLabel('glow') as Sprite | null;
      if (!g) return;
      const pulse = 0.5 + 0.5 * Math.sin(t * 2 + i * 1.3);
      g.scale.set(1.3 + 0.25 * pulse);
      g.alpha = 0.3 + 0.25 * pulse;
      if (Math.random() < 0.4 / 60) {
        const p = fx.one(fx.add, fx.t.dot, this.box.cx + c.x + rand(-0.5, 0.5), this.box.cy + c.y - 0.6, 1.2, g.tint as number, 0.25, 0.05);
        if (p) p.vy = -2;
      }
    });
  }

  /** A note per expedition, out or back; back ones glint. */
  private board(s: GameState, t: number, dt: number, fx: WorldFx): void {
    const ex = s.hero.hearth.expeditions;
    const pins = this.spots.pins ?? [];
    const key = ex.map((e) => (e.left <= 0 ? 'r' : 'o')).join('');
    if (key !== this.key) {
      this.key = key;
      for (const p of this.pins) {
        p.g.destroy();
        p.glow.destroy();
      }
      this.pins.length = 0;
      ex.slice(0, pins.length).forEach((e, i) => {
        const ready = e.left <= 0;
        const glow = new Sprite(this.atlas.get('glow'));
        glow.blendMode = 'add';
        glow.tint = HUB.gold;
        glow.position.set(pins[i]!.x, pins[i]!.y);
        glow.visible = ready;
        const g = shapeGraphics(ready ? readyCtx! : paperCtx!, this.extra);
        g.position.set(pins[i]!.x, pins[i]!.y);
        g.rotation = (i - 1) * 0.08;
        this.extra.addChildAt(glow, this.extra.getChildIndex(g));
        this.pins.push({ g, ready, glow });
      });
    }
    this.pins.forEach((p, i) => {
      if (!p.ready) return;
      const ph = Math.sin((t + i * 0.4) * TAU * F.glintHz);
      p.glow.scale.set(1.6 + 0.4 * ph);
      p.glow.alpha = 0.35 + 0.25 * ph;
      if (Math.random() < 1.5 * dt) {
        const q = fx.one(fx.top, fx.t.star, this.box.cx + p.g.x + rand(-0.8, 0.8), this.box.cy + p.g.y + rand(-0.9, 0.6), 0.4, 0xffffff, 0.45, 0.05);
        if (q) q.vy = -0.5;
      }
    });
  }

  flourish(fx: WorldFx, strong: boolean): void {
    const { cx, cy } = this.box;
    const y = cy + this.spots.top * 0.5;
    fx.burst(fx.top, fx.t.star, cx, y, strong ? 16 : 6, [3, strong ? 9 : 5], [0.4, 0.8], [0xffffff, HUB.gold, HUB.ember], [0.5, 0.1], 3, (q) => (q.drag = 2.5));
    if (strong) fx.groundRing(cx, cy + 3, 2, 8, 0.6, HUB.gold, 0.7);
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}

