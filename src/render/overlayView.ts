import { Container, Graphics } from 'pixi.js';
import { TILE_CELLS, type GameState, type Room } from '../sim';
import { OVERLAY } from './palette';

/**
 * Debug overlays (F1), drawn in world space above everything else.
 * `grid` is rebuilt when it turns on or the room changes; `hitboxes` redraws per frame.
 */
export class OverlayView {
  readonly root = new Container();
  private readonly grid = new Graphics();
  private readonly hitboxes = new Graphics();
  private gridRoom: Room | null = null;

  constructor() {
    this.root.addChild(this.grid, this.hitboxes);
    this.grid.visible = false;
    this.hitboxes.visible = false;
  }

  invalidate(): void {
    this.gridRoom = null;
  }

  update(
    s: GameState,
    flags: { grid: boolean; hitboxes: boolean },
    px: number,
    py: number,
    aim: { x: number; y: number },
    scale: number,
  ): void {
    this.grid.visible = flags.grid;
    if (flags.grid && this.gridRoom !== s.room) this.buildGrid(s.room);
    this.hitboxes.visible = flags.hitboxes;
    if (flags.hitboxes) this.drawHitboxes(s, px, py, aim, scale);
  }

  private buildGrid(room: Room): void {
    this.gridRoom = room;
    const g = this.grid.clear();
    // Solid cells, merged into horizontal runs.
    for (let cy = 0; cy < room.height; cy++) {
      let start = -1;
      for (let cx = 0; cx <= room.width; cx++) {
        const solid = cx < room.width && room.solid[cy * room.width + cx] === 1;
        if (solid && start < 0) start = cx;
        if (!solid && start >= 0) {
          g.rect(start, cy, cx - start, 1);
          start = -1;
        }
      }
    }
    g.fill({ color: OVERLAY.solid, alpha: OVERLAY.solidAlpha });
    for (const tiles of [false, true]) {
      const step = tiles ? TILE_CELLS : 1;
      for (let x = 0; x <= room.width; x += step) {
        if (tiles || x % TILE_CELLS !== 0) g.moveTo(x, 0).lineTo(x, room.height);
      }
      for (let y = 0; y <= room.height; y += step) {
        if (tiles || y % TILE_CELLS !== 0) g.moveTo(0, y).lineTo(room.width, y);
      }
      g.stroke({
        width: 1,
        pixelLine: true,
        color: OVERLAY.grid,
        alpha: tiles ? OVERLAY.tileGridAlpha : OVERLAY.gridAlpha,
      });
    }
  }

  private drawHitboxes(s: GameState, px: number, py: number, aim: { x: number; y: number }, scale: number): void {
    const p = s.player;
    const px1 = 1.5 / scale;
    const color = p.iframesLeft > 0 ? OVERLAY.hitboxIframes : p.dodgeLeft > 0 ? OVERLAY.hitboxDodge : OVERLAY.hitbox;
    const g = this.hitboxes.clear();
    // Input aim: player to the cursor's world point.
    g.moveTo(px, py).lineTo(aim.x, aim.y).stroke({ width: px1, color: OVERLAY.aimLine, alpha: 0.45 });
    g.circle(aim.x, aim.y, 3 * px1).stroke({ width: px1, color: OVERLAY.aimLine, alpha: 0.7 });
    // Sim aim direction, a short solid ray.
    const r = s.tuning.player.radius;
    g.moveTo(px, py)
      .lineTo(px + p.aimDirX * (r + 3), py + p.aimDirY * (r + 3))
      .stroke({ width: 2 * px1, color, alpha: 0.95 });
    g.circle(px, py, r).fill({ color, alpha: 0.12 }).stroke({ width: 2 * px1, color, alpha: 0.95 });
    g.circle(px, py, 2 * px1).fill(color);
  }
}
