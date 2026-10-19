import { CELL_PX } from '../sim';
import type { Tuning } from '../../data/tuning';

/** Reference screen height the cell size is defined at (DESIGN §4: 8 px per cell at 720p). */
const REF_HEIGHT = 720;

/**
 * Follow camera. Holds the world-to-screen transform the renderer draws with:
 *   screen = world × scale + offset   (CSS pixels)
 * so screenToWorld is its exact inverse.
 *
 * Look-ahead comes from the cursor's screen offset from the view center, not
 * from the world aim point. The aim point is derived from the camera, so
 * looking ahead toward it would chase itself; the screen offset doesn't move
 * when the camera moves, so the target is stable and the smoothing converges.
 */
export class Camera {
  /** Camera center in cells. */
  x = 0;
  y = 0;
  /** CSS pixels per cell. */
  scale = CELL_PX;
  /** Screen position of world (0, 0), CSS pixels, snapped to device pixels. */
  offsetX = 0;
  offsetY = 0;
  private cursorX = 0;
  private cursorY = 0;
  private hasCursor = false;
  private snapNext = true;

  /** Cursor in CSS pixels relative to the canvas. */
  setCursor(sx: number, sy: number): void {
    this.cursorX = sx;
    this.cursorY = sy;
    this.hasCursor = true;
  }

  /** Jump straight to the target on the next update (room change, reset). */
  snap(): void {
    this.snapNext = true;
  }

  /**
   * Moves toward the follow point plus look-ahead with exponential smoothing,
   * which is frame-rate independent: after t seconds the remaining gap is
   * exp(-t / smoothing) of what it was, however t is split into frames.
   */
  update(
    followX: number,
    followY: number,
    room: { width: number; height: number },
    screenW: number,
    screenH: number,
    resolution: number,
    tuning: Tuning['camera'],
    dt: number,
  ): void {
    this.scale = CELL_PX * (screenH / REF_HEIGHT) * tuning.zoom;
    let tx = followX;
    let ty = followY;
    if (this.hasCursor && screenW > 0 && screenH > 0) {
      const nx = clamp((this.cursorX - screenW / 2) / (screenW / 2), -1, 1);
      const ny = clamp((this.cursorY - screenH / 2) / (screenH / 2), -1, 1);
      tx += (nx * tuning.lookAhead * screenW) / this.scale;
      ty += (ny * tuning.lookAhead * screenH) / this.scale;
    }
    const halfW = screenW / 2 / this.scale;
    const halfH = screenH / 2 / this.scale;
    // The bottom HUD covers the lowest part of the screen: the view may scroll that far past the
    // room's bottom edge, so the bottom rows (and arrivals from the south) are never hidden.
    const inset = (tuning.hudInset * screenH) / this.scale;
    tx = clampAxis(tx, halfW, room.width, tuning.edgeMargin);
    ty = clampAxis(ty, halfH, room.height, tuning.edgeMargin, inset);

    if (this.snapNext || tuning.smoothing <= 0) {
      this.x = tx;
      this.y = ty;
      this.snapNext = false;
    } else {
      const k = 1 - Math.exp(-dt / tuning.smoothing);
      this.x += (tx - this.x) * k;
      this.y += (ty - this.y) * k;
    }
    // Clamp the smoothed position too, so a resize or zoom change never shows the void.
    this.x = clampAxis(this.x, halfW, room.width, tuning.edgeMargin);
    this.y = clampAxis(this.y, halfH, room.height, tuning.edgeMargin, inset);

    // Snap the world origin to device pixels so static lines stay crisp.
    const r = resolution > 0 ? resolution : 1;
    this.offsetX = Math.round((screenW / 2 - this.x * this.scale) * r) / r;
    this.offsetY = Math.round((screenH / 2 - this.y * this.scale) * r) / r;
  }

  /** The cursor in world cells (the view center before the cursor has moved). */
  cursorWorld(): { x: number; y: number } {
    return this.hasCursor ? this.screenToWorld(this.cursorX, this.cursorY) : { x: this.x, y: this.y };
  }

  /** CSS pixels on the canvas to world cells; the exact inverse of the draw transform. */
  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return { x: (sx - this.offsetX) / this.scale, y: (sy - this.offsetY) / this.scale };
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Keeps the view inside [−margin, size + margin], or centers the room when the view is larger. */
/**
 * Clamps a view center to a room axis: up to `margin` cells of void past either edge, plus
 * `farInset` past the far edge (the bottom HUD). A room smaller than the view is centered in the
 * part of the screen the HUD leaves visible.
 */
function clampAxis(center: number, half: number, size: number, margin: number, farInset = 0): number {
  const lo = half - margin;
  const hi = size - half + margin + farInset;
  if (lo > hi) return (size + farInset) / 2;
  return clamp(center, lo, hi);
}
