import { lookKind } from '../../../data/enemies';
import { BitmapText, Container, Graphics } from 'pixi.js';
import type { Enemy, GameState } from '../../sim';
import { M4_STATE } from '../../app/m4Wiring';
import type { Atlas, AtlasEntry } from '../atlas';
import { INK } from '../combatPalette';
import { FONT, installFont } from '../damageNumbers';
import { artScale, bodyBoxOf } from '../kindInfo';
import { layoutOf } from '../enemyRig';
import { ImmediatePool } from '../particles';
import type { Pen } from '../pen';
import type { EnemyLayer } from '../enemyLayer';
import { RARITY as R } from './bestiaryPalette';

/** Display names for the plates (M1 kinds from data/enemies.ts names, M4 from CONTENT §5). */
const NAMES: Record<string, string> = {
  tinderling: 'Tinderling',
  shieldbearer: 'Shieldbearer',
  ember_archer: 'Ember Archer',
  bog_lurker: 'Bog Lurker',
  tar_hulk: 'Tar Hulk',
  frost_wisp: 'Frost Wisp',
  stormcaller: 'Stormcaller',
  kiln_mite: 'Kiln Mite',
  brood_kiln: 'Brood Kiln',
  tar_matriarch: 'Tar Matriarch',
  cinder_warden: 'Cinder Warden',
};

/** "thick_skinned" → "Thick-skinned" (CONTENT §5 mod names). */
export function modName(id: string): string {
  const s = id.replace(/_/g, '-');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** A ground ring with an ink rim (white core, tinted per rarity). */
function rarityRing(p: Pen): void {
  p.ellipse(0, 0, 1, 1).stroke(0.3, INK, 0.75);
  p.ellipse(0, 0, 1, 1).stroke(0.14, 0xffffff);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const x = Math.cos(a);
    const y = Math.sin(a);
    p.poly([
      x * 0.86,
      y * 0.86,
      x * 1.14 - y * 0.1,
      y * 1.14 + x * 0.1,
      x * 1.14 + y * 0.1,
      y * 1.14 - x * 0.1,
    ]);
    p.fill(0xffffff).stroke(0.06, INK);
  }
}

export function rarityAtlasEntries(): AtlasEntry[] {
  return [{ name: 'rarity_ring', x0: -1.25, y0: -1.25, x1: 1.25, y1: 1.25, draw: rarityRing }];
}

interface Plate {
  root: Container;
  bg: Graphics;
  name: BitmapText;
  mods: BitmapText;
  key: string;
}

/**
 * Monster rarity (CONTENT §5): Magic enemies stand on a pulsing blue ring, Rares on a gold ring
 * with a soft glow and a name plate listing their mods. Rings are flat ellipses on the ground, so
 * hundreds stay cheap and never cover bodies; plates go to the nearest Rares only.
 */
export class RarityView {
  /** Under the bodies, with the shadows. */
  readonly ground: ImmediatePool;
  readonly glows: ImmediatePool;
  /** Screen space. */
  readonly plates = new Container();
  private readonly pool: Plate[] = [];
  private time = 0;
  private readonly near: Enemy[] = [];

  constructor(private readonly atlas: Atlas) {
    installFont();
    this.glows = new ImmediatePool(atlas.get('glow'), 128, 'normal');
    this.ground = new ImmediatePool(atlas.get('rarity_ring'), 512);
  }

  update(
    s: GameState,
    enemies: EnemyLayer,
    dt: number,
    xf: { scale: number; ox: number; oy: number; screenScale: number },
  ): void {
    this.time += dt;
    const ring = this.atlas.get('rarity_ring');
    const glow = this.atlas.get('glow');
    this.ground.begin();
    this.glows.begin();
    this.near.length = 0;
    const pulse = 1 - R.pulseDepth * (0.5 + 0.5 * Math.sin(this.time * Math.PI * 2 * R.pulseHz));
    for (const e of s.enemies) {
      if (e.dead || e.rarity === 'normal') continue;
      const v = enemies.view(e.id);
      if (!v || v.dying >= 0) continue;
      const L = layoutOf(lookKind(e.kind));
      const k = artScale(lookKind(e.kind), e.radius);
      const color = e.rarity === 'rare' ? R.rare : R.magic;
      const x = v.root.x;
      const y = v.root.y + L.shadowY * k;
      if (e.rarity === 'rare') {
        const g = this.glows.next(glow);
        if (g) {
          g.x = x;
          g.y = y;
          g.scaleX = L.shadowRx * k * 1.8;
          g.scaleY = L.shadowRy * k * 1.8;
          g.paint(color, R.rareGlowAlpha * pulse);
        }
        this.near.push(e);
      }
      const p = this.ground.next(ring);
      if (!p) continue;
      p.x = x;
      p.y = y;
      const sc = R.ringScale * (e.rarity === 'rare' ? 1.08 : 1);
      p.scaleX = L.shadowRx * k * sc * (0.97 + 0.03 * pulse);
      p.scaleY = L.shadowRy * k * sc * 1.2 * (0.97 + 0.03 * pulse);
      p.rotation = 0;
      p.paint(color, R.ringAlpha * (0.75 + 0.25 * pulse));
    }
    this.ground.end();
    this.glows.end();
    this.updatePlates(s, enemies, xf);
  }

  private updatePlates(
    s: GameState,
    enemies: EnemyLayer,
    xf: { scale: number; ox: number; oy: number; screenScale: number },
  ): void {
    const px = s.player.x;
    const py = s.player.y;
    this.near.sort((a, b) => (a.x - px) ** 2 + (a.y - py) ** 2 - ((b.x - px) ** 2 + (b.y - py) ** 2));
    const n = Math.min(this.near.length, R.plateMax);
    for (let i = 0; i < n; i++) {
      const e = this.near[i]!;
      const v = enemies.view(e.id)!;
      const plate = this.plate(i, e);
      const k = artScale(lookKind(e.kind), e.radius);
      const top = v.root.y + bodyBoxOf(lookKind(e.kind)).top * k - R.plateGap;
      plate.root.position.set(Math.round(v.root.x * xf.scale + xf.ox), Math.round(top * xf.scale + xf.oy));
      plate.root.scale.set(xf.screenScale);
      plate.root.visible = true;
    }
    for (let i = n; i < this.pool.length; i++) this.pool[i]!.root.visible = false;
  }

  private plate(i: number, e: Enemy): Plate {
    let p = this.pool[i];
    if (!p) {
      const root = new Container();
      const bg = new Graphics();
      const name = new BitmapText({ text: '', style: { fontFamily: FONT, fontSize: R.plateSize + 1 } });
      const mods = new BitmapText({ text: '', style: { fontFamily: FONT, fontSize: R.plateSize - 1 } });
      name.anchor.set(0.5, 1);
      mods.anchor.set(0.5, 1);
      name.tint = R.plateText;
      mods.tint = R.plateMods;
      root.addChild(bg, name, mods);
      this.plates.addChild(root);
      p = { root, bg, name, mods, key: '' };
      this.pool.push(p);
    }
    const mods = M4_STATE.mods(e).map(modName).join(' · ');
    const key = `${e.kind}|${mods}`;
    if (p.key !== key) {
      p.key = key;
      p.name.text = NAMES[e.kind] ?? e.kind;
      p.mods.text = mods;
      const h1 = R.plateSize + 3;
      const h2 = mods ? R.plateSize + 1 : 0;
      p.mods.position.set(0, -3);
      p.name.position.set(0, -3 - h2);
      const w = Math.max(p.name.width, p.mods.width) + 14;
      const h = h1 + h2 + 6;
      p.bg.clear();
      p.bg.roundRect(-w / 2, -h, w, h, 5).fill({ color: R.plateBg, alpha: R.plateBgAlpha });
      p.bg.roundRect(-w / 2, -h, w, h, 5).stroke({ width: 1.5, color: R.rare, alpha: 0.8 });
    }
    return p;
  }
}
