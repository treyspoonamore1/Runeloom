import { Container, Graphics, Text } from 'pixi.js';
import { BUILDING_IDS, hearthRoom, stations, type BuildingId, type StationId } from '../../../data/hearth';
import type { GameState, SimEvent } from '../../sim';
import { TILE_CELLS as T } from '../../sim';
import { isStationKind, stationHere } from '../../sim/world/hub';
import type { Atlas } from '../atlas';
import { clamp } from '../mathx';
import { LINE } from '../palette';
import type { WorldFx } from '../world/worldFx';
import { BuildingView } from './buildingView';
import { HUB, HUB_FEEL as F } from './hubPalette';
import { flameCtx, FireView, NpcView, type StationBox, type StationView } from './stationViews';

const BUILDINGS: ReadonlySet<string> = new Set(BUILDING_IDS);

/**
 * The Hearth's hub (M7): NPCs, the Hearth fire and the four buildings (drawn by level from
 * hero.hearth), plus the "F  <name>" prompt over the station `stationHere` returns. Station views
 * go into the object layer (sorted by y with the other objects); the prompt sits in `top`, above
 * the bodies. Reads state only.
 */
export class HubView {
  /** World-space layer above the bodies (the prompt). */
  readonly top = new Container();
  private readonly views = new Map<StationId, StationView>();
  private readonly boxes = new Map<StationId, StationBox>();
  private roomId = '';
  private time = 0;
  private prompt: Container | null = null;
  private promptFor: StationId | null = null;
  private promptAlpha = 0;

  constructor(
    private readonly atlas: Atlas,
    private readonly fx: WorldFx,
    private readonly layer: Container,
  ) {}

  reset(): void {
    for (const v of this.views.values()) v.destroy();
    this.views.clear();
    this.boxes.clear();
    this.roomId = '';
    this.clearPrompt();
  }

  update(s: GameState, dt: number): void {
    this.time += dt;
    if (s.room.id !== this.roomId) {
      this.reset();
      this.roomId = s.room.id;
      if (s.room.id === hearthRoom) this.build(s);
    }
    if (this.views.size === 0) return;
    for (const v of this.views.values()) v.update(s, this.time, dt, this.fx);
    this.updatePrompt(s, dt);
  }

  /** Station flourishes and sounds' visual half: use, upgrade, the Hearth lit. */
  handle(events: readonly SimEvent[]): void {
    if (this.views.size === 0) return;
    for (const e of events) {
      if (e.type === 'stationUse') this.views.get(e.station)?.flourish(this.fx, false);
      else if (e.type === 'buildingUpgraded') this.views.get(e.building)?.flourish(this.fx, true);
      else if (e.type === 'hearthLit') this.views.get('hearth_fire')?.flourish(this.fx, true);
    }
  }

  private build(s: GameState): void {
    const tiles = new Map<StationId, { x0: number; y0: number; x1: number; y1: number }>();
    for (const o of s.objects) {
      if (!isStationKind(o.kind)) continue;
      const b = tiles.get(o.kind);
      if (!b) tiles.set(o.kind, { x0: o.tx, y0: o.ty, x1: o.tx, y1: o.ty });
      else {
        b.x0 = Math.min(b.x0, o.tx);
        b.y0 = Math.min(b.y0, o.ty);
        b.x1 = Math.max(b.x1, o.tx);
        b.y1 = Math.max(b.y1, o.ty);
      }
    }
    for (const [id, b] of tiles) {
      const box: StationBox = {
        cx: ((b.x0 + b.x1 + 1) / 2) * T,
        cy: ((b.y0 + b.y1 + 1) / 2) * T,
        w: (b.x1 - b.x0 + 1) * T,
        h: (b.y1 - b.y0 + 1) * T,
      };
      const v: StationView =
        id === 'hearth_fire'
          ? new FireView(this.atlas, box, flameCtx(), s.hero.hearth.lit)
          : BUILDINGS.has(id)
            ? new BuildingView(this.atlas, id as BuildingId, box)
            : new NpcView(id as 'spindlewright' | 'runekeeper' | 'cartographer', box);
      // Lower stations draw over higher ones, like the objects (ObjectView: tile center y × 4).
      v.root.zIndex = Math.round((b.y1 + 0.5) * T * 4);
      this.layer.addChild(v.root);
      this.views.set(id, v);
      this.boxes.set(id, box);
    }
  }

  private updatePrompt(s: GameState, dt: number): void {
    const here = stationHere(s);
    if (here && here !== this.promptFor) {
      this.clearPrompt();
      this.prompt = makePrompt(stations[here].name);
      this.promptFor = here;
      this.promptAlpha = 0;
      this.top.addChild(this.prompt);
    }
    if (!this.prompt) return;
    this.promptAlpha = clamp(this.promptAlpha + ((here ? 1 : -1) * dt) / F.promptFade, 0, 1);
    if (!here && this.promptAlpha <= 0) {
      this.clearPrompt();
      return;
    }
    const id = this.promptFor!;
    const box = this.boxes.get(id)!;
    const v = this.views.get(id)!;
    const bob = Math.sin(this.time * 3) * 0.12;
    this.prompt.alpha = this.promptAlpha;
    // Stations against the north wall would push the plate off the top of the screen (and under
    // the HUD's corner panels on a phone): there it floats over the player instead.
    const y = box.cy + v.top() - F.promptGap;
    const p = s.player;
    if (y >= F.promptMinY) this.prompt.position.set(box.cx, y + bob);
    else this.prompt.position.set(p.x, p.y - F.promptOverPlayer + bob);
  }

  private clearPrompt(): void {
    this.prompt?.destroy({ children: true });
    this.prompt = null;
    this.promptFor = null;
  }
}

/** "[F] Name" on a dark plate, bottom-centered on (0, 0). */
function makePrompt(name: string): Container {
  const c = new Container();
  const fontPx = 36;
  const k = F.promptText / fontPx;
  const text = new Text({
    text: name,
    resolution: 2,
    style: { fontFamily: 'Arial Black, Arial, sans-serif', fontSize: fontPx, fill: HUB.plateText, fontWeight: '900' },
  });
  text.scale.set(k);
  const keyText = new Text({
    text: 'F',
    resolution: 2,
    style: { fontFamily: 'Arial Black, Arial, sans-serif', fontSize: fontPx, fill: HUB.plate, fontWeight: '900' },
  });
  keyText.scale.set(k);
  const pad = 0.55;
  const keyW = Math.max(keyText.width + 0.7, 2.0);
  const h = Math.max(text.height, keyText.height) + pad * 2;
  const w = keyW + 0.6 + text.width + pad * 2;
  const g = new Graphics();
  g.roundRect(-w / 2 + 0.2, -h + 0.3, w, h, 0.6).fill({ color: 0x000000, alpha: 0.3 });
  g.roundRect(-w / 2, -h, w, h, 0.6).fill({ color: HUB.plate, alpha: 0.9 }).stroke({ width: LINE.detail, color: HUB.key, alpha: 0.6 });
  g.roundRect(-w / 2 + pad, -h + pad * 0.7, keyW, h - pad * 1.4, 0.4).fill(HUB.key).stroke({ width: LINE.detail, color: 0x000000, alpha: 0.4 });
  keyText.position.set(-w / 2 + pad + (keyW - keyText.width) / 2, -h + (h - keyText.height) / 2);
  text.position.set(-w / 2 + pad + keyW + 0.6, -h + (h - text.height) / 2);
  c.addChild(g, keyText, text);
  return c;
}
