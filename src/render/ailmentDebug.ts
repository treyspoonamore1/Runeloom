import { BitmapText, Container } from 'pixi.js';
import type { Ailments } from '../sim';
import { AIL } from './ailmentPalette';
import { FONT, installFont } from './damageNumbers';

const LABEL_PX = 10;
const FONT_SIZE = 48;
const LINE = 1.15;

/**
 * F1 "hitboxes" companion: exact ailment numbers next to each ailing body: chill points (or
 * frozen seconds), shock % and ignite dps. Pooled bitmap text in screen space; strings are
 * rebuilt only when a shown value changes.
 */
export class AilmentDebug {
  readonly labels = new Container();
  private readonly texts: BitmapText[] = [];
  private n = 0;
  private on = false;

  constructor() {
    installFont();
  }

  begin(on: boolean): void {
    this.on = on;
    this.n = 0;
    this.labels.visible = on;
  }

  /** Labels for one body; (x, y) in cells is where the first line goes. */
  label(a: Ailments, x: number, y: number, xf: { scale: number; ox: number; oy: number; screenScale: number }): void {
    if (!this.on) return;
    const sx = x * xf.scale + xf.ox;
    let sy = y * xf.scale + xf.oy;
    const step = LABEL_PX * xf.screenScale * LINE;
    if (a.freeze.timeLeft > 0) {
      this.line(`frz ${a.freeze.timeLeft.toFixed(2)}s`, AIL.frost, sx, sy, xf.screenScale);
      sy += step;
    } else if (a.chill > 0) {
      this.line(`chl ${a.chill.toFixed(1)}`, AIL.frost, sx, sy, xf.screenScale);
      sy += step;
    }
    if (a.shock.timeLeft > 0) {
      this.line(`shk ${Math.round(a.shock.effect * 100)}% ${a.shock.timeLeft.toFixed(1)}s`, AIL.storm, sx, sy, xf.screenScale);
      sy += step;
    }
    if (a.ignite.timeLeft > 0) {
      this.line(`ign ${a.ignite.dps.toFixed(1)}/s ${a.ignite.timeLeft.toFixed(1)}s`, AIL.fire, sx, sy, xf.screenScale);
    }
  }

  end(): void {
    for (let i = this.n; i < this.texts.length; i++) this.texts[i]!.visible = false;
  }

  private line(s: string, tint: number, x: number, y: number, screenScale: number): void {
    let t = this.texts[this.n];
    if (!t) {
      t = new BitmapText({ text: s, style: { fontFamily: FONT, fontSize: FONT_SIZE } });
      t.anchor.set(0, 0.5);
      this.texts.push(t);
      this.labels.addChild(t);
    }
    this.n++;
    t.visible = true;
    if (t.text !== s) t.text = s;
    t.tint = tint;
    t.position.set(x, y);
    t.scale.set((LABEL_PX * screenScale) / FONT_SIZE);
  }
}
