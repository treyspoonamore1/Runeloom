import { Container, Sprite } from 'pixi.js';
import type { GameState } from '../../sim';
import type { LootContent, LootDrop } from '../../sim/items/loot';
import type { M4Cue } from '../../app/m4Signals';
import { filterAction } from '../../app/lootFilterStore';
import type { LootAction } from '../../sim/items/lootFilter';
import { getRune } from '../../../data/runes';
import type { Atlas } from '../atlas';
import { rand } from '../ailmentBursts';
import { ELEMENT } from '../combatPalette';
import { smoothstep } from '../mathx';
import type { WorldFx } from './worldFx';
import { LOOT as L } from './worldPalette';

const TAU = Math.PI * 2;
const ELEMENT_COLOR: Record<string, number> = {
  fire: ELEMENT.fire,
  frost: ELEMENT.frost,
  storm: ELEMENT.storm,
  tide: 0x2f7bff,
  gale: 0xe8f4f0,
};

export interface LootLook {
  tex: string;
  tint: number;
  glyph: string | null;
  glyphTint: number;
  /** Rarity or kind color for the ring, glow and pickup sparkle. */
  color: number;
  beam: boolean;
}

/** How a drop looks: rune stones by kind (element runes by element), items by rarity. */
export function lootLook(c: LootContent): LootLook {
  switch (c.kind) {
    case 'rune': {
      const def = getRune(c.rune.rune);
      const kind = def?.kind ?? 'form';
      const color = L.runeKind[kind];
      const glyphTint = kind === 'element' ? (ELEMENT_COLOR[c.rune.rune] ?? color) : color;
      return { tex: 'rune_stone', tint: color, glyph: `glyph_${kind}`, glyphTint, color, beam: false };
    }
    case 'item': {
      const color = L.rarity[c.item.rarity];
      return {
        tex: 'loot_satchel',
        tint: 0xffffff,
        glyph: 'loot_gem',
        glyphTint: color,
        color,
        beam: c.item.rarity === 'rare' || c.item.rarity === 'unique',
      };
    }
    case 'part':
      return { tex: 'loot_part', tint: L.part, glyph: null, glyphTint: 0, color: L.part, beam: false };
    case 'scrap':
      return { tex: 'loot_scrap', tint: 0xffffff, glyph: null, glyphTint: 0, color: L.scrap, beam: false };
    case 'currency': {
      const color = L.currency[c.currency];
      return { tex: 'loot_currency', tint: color, glyph: null, glyphTint: 0, color, beam: false };
    }
  }
}

interface DropView {
  root: Container;
  item: Sprite;
  glyph: Sprite;
  ring: Sprite;
  glow: Sprite;
  beam: Sprite;
  look: LootLook;
  seed: number;
  seen: number;
  /** The loot filter's answer when it was made (a filter change remakes it). */
  action: LootAction;
}

/**
 * Loot on the floor (state.loot): drops pop out in a short arc, then bob and glint on a rarity
 * ring; rare and unique items stand in a light beam. Picked-up drops fly to the player.
 */
export class LootView {
  readonly root = new Container();
  private readonly views = new Map<number, DropView>();
  private readonly pool: DropView[] = [];
  private time = 0;
  private frame = 0;

  constructor(
    private readonly atlas: Atlas,
    private readonly fx: WorldFx,
  ) {}

  reset(): void {
    for (const v of this.views.values()) this.release(v);
    this.views.clear();
  }

  handle(c: M4Cue, s: GameState): void {
    if (c.type !== 'lootPicked' || !c.content || filterAction(c.content) === 'hide') return;
    const look = lootLook(c.content);
    const fx = this.fx;
    // The drop flies to the player and sparkles in its color.
    const life = L.pickupTime;
    const p = fx.top.spawn(
      this.atlas.get(look.tex),
      c.x,
      c.y - 0.6,
      (s.player.x - c.x) / life,
      (s.player.y - 1 - c.y + 0.6) / life,
      life,
      look.tint,
      0.9,
      0.4,
    );
    if (p) p.hold = 0.7;
    fx.one(fx.add, fx.t.glow, s.player.x, s.player.y - 1, 0.3, look.color, 1, 2.5, 0.7);
    fx.burst(
      fx.top,
      fx.t.star,
      c.x,
      c.y - 0.6,
      5,
      [2, 6],
      [0.2, 0.4],
      [0xffffff, look.color],
      [0.6, 0.1],
      0.4,
      (q) => (q.drag = 3),
    );
  }

  update(s: GameState, dt: number): void {
    this.time += dt;
    const f = ++this.frame;
    for (const d of s.loot) {
      // The loot filter (app/lootFilterStore.ts): hidden drops aren't drawn; highlighted ones get a beam.
      const act = filterAction(d.content);
      let v = this.views.get(d.id);
      if (v && v.action !== act) {
        this.views.delete(d.id);
        this.release(v);
        v = undefined;
      }
      if (act === 'hide') continue;
      if (!v) {
        v = this.make(d, act);
        this.views.set(d.id, v);
      }
      v.seen = f;
      this.pose(v, d);
    }
    for (const [id, v] of this.views) {
      if (v.seen === f) continue;
      this.views.delete(id);
      this.release(v);
    }
  }

  private make(d: LootDrop, action: LootAction): DropView {
    const look = lootLook(d.content);
    if (action === 'highlight') look.beam = true;
    let v = this.pool.pop();
    if (!v) {
      const root = new Container();
      const sprite = (name: string): Sprite => {
        const sp = new Sprite(this.atlas.get(name));
        root.addChild(sp);
        return sp;
      };
      const beam = sprite('loot_beam');
      const ring = sprite('rarity_ring');
      const glow = sprite('glow');
      const item = sprite('rune_stone');
      const glyph = sprite('glyph_form');
      v = { root, item, glyph, ring, glow, beam, look, seed: 0, seen: 0, action };
    }
    v.look = look;
    v.action = action;
    v.seed = Math.random() * 10;
    v.item.texture = this.atlas.get(look.tex);
    v.item.tint = look.tint;
    v.glyph.visible = look.glyph !== null;
    if (look.glyph) {
      v.glyph.texture = this.atlas.get(look.glyph);
      v.glyph.tint = look.glyphTint;
    }
    v.ring.tint = v.glow.tint = v.beam.tint = look.color;
    v.beam.visible = look.beam;
    this.root.addChild(v.root);
    return v;
  }

  private pose(v: DropView, d: LootDrop): void {
    const t = this.time + v.seed;
    const u = Math.min(1, d.age / L.dropTime);
    // Pop out in an arc, land with a squash, then bob.
    const arc = Math.sin(u * Math.PI) * L.dropHeight;
    const landed = u >= 1;
    const bob = landed ? Math.sin(t * TAU * L.bobHz) * L.bob : 0;
    const squash = landed ? Math.max(0, 1 - (d.age - L.dropTime) * 6) * 0.25 : 0;
    v.root.position.set(d.x, d.y);
    v.item.position.set(0, -0.6 - arc - bob);
    v.item.rotation = landed ? Math.sin(t * 1.7) * 0.08 : u * TAU;
    v.item.scale.set(1 + squash, 1 - squash);
    v.glyph.position.set(0, (v.look.tex === 'loot_satchel' ? -0.35 : -0.55) - arc - bob);
    v.glyph.rotation = v.item.rotation;
    const appear = smoothstep(0.6, 1, u);
    v.ring.position.set(0, 0.35);
    v.ring.scale.set(1.25, 0.6);
    v.ring.alpha = 0.85 * appear;
    v.glow.position.set(0, -0.5 - bob);
    v.glow.scale.set(1.8 + 0.2 * Math.sin(t * 3));
    v.glow.alpha = 0.3 * appear;
    if (v.look.beam) {
      v.beam.position.set(0, 0.3);
      v.beam.scale.set(L.beamWidth * (0.9 + 0.1 * Math.sin(t * 2.3)), L.beamHeight * appear);
      v.beam.alpha = L.beamAlpha * appear;
    }
    if (landed && Math.random() < 0.8 / 60) {
      const p = this.fx.one(
        this.fx.top,
        this.fx.t.star,
        d.x + rand(-0.6, 0.6),
        d.y - 0.6 + rand(-0.6, 0.3),
        0.35,
        0xffffff,
        0.5,
        0.05,
        0.9,
      );
      void p;
    }
  }

  private release(v: DropView): void {
    v.root.parent?.removeChild(v.root);
    this.pool.push(v);
  }
}
