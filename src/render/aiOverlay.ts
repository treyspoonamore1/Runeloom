import { BitmapText, Container, Graphics } from 'pixi.js';
import { PLAYER_ID, type GameState } from '../sim';
import { enemyDef } from '../../data/enemies';
import { FONT, installFont } from './damageNumbers';
import type { EnemyLayer } from './enemyLayer';

const MODE_COLORS: Record<string, number> = {
  idle: 0xb8b8c8,
  aggro: 0xffd23f,
  attack: 0xff2a6d,
  recover: 0x7fc0ff,
};
const LABEL_PX = 11;
const FONT_SIZE = 48;

/**
 * F1 "AI targets" overlay: each enemy's ai.mode as a tiny label, a line to its target and its
 * attack range circle (body radius + AttackDef.range, the edge-to-edge reach). World lines are
 * redrawn per frame while on; labels are pooled bitmap text in screen space.
 */
export class AiOverlay {
  readonly world = new Graphics();
  readonly labels = new Container();
  private readonly texts: BitmapText[] = [];

  constructor() {
    installFont();
  }

  hide(): void {
    this.world.visible = false;
    this.labels.visible = false;
  }

  update(s: GameState, enemies: EnemyLayer, scale: number, ox: number, oy: number, screenScale: number): void {
    this.world.visible = true;
    this.labels.visible = true;
    const g = this.world.clear();
    const px = 1.25 / scale;
    let n = 0;
    for (const e of s.enemies) {
      const v = enemies.view(e.id);
      const x = v ? v.x : e.x;
      const y = v ? v.y : e.y;
      const color = MODE_COLORS[e.ai.mode] ?? 0xffffff;
      const def = enemyDef(e.kind).attack;
      if (def) g.circle(x, y, e.radius + def.range).stroke({ width: px, color, alpha: 0.45 });
      if (e.ai.targetId === PLAYER_ID) {
        g.moveTo(x, y).lineTo(s.player.x, s.player.y).stroke({ width: px, color, alpha: 0.7 });
      } else if (e.ai.targetId > 0) {
        const t = enemies.view(e.ai.targetId);
        if (t) g.moveTo(x, y).lineTo(t.x, t.y).stroke({ width: px, color, alpha: 0.7 });
      }
      g.moveTo(x, y)
        .lineTo(x + e.facingX * (e.radius + 1), y + e.facingY * (e.radius + 1))
        .stroke({ width: 2 * px, color: 0xffffff, alpha: 0.8 });
      const t = this.text(n++);
      if (t.text !== e.ai.mode) t.text = e.ai.mode;
      t.tint = color;
      t.position.set(x * scale + ox, (y - e.radius - 2.4) * scale + oy);
      t.scale.set((LABEL_PX * screenScale) / FONT_SIZE);
    }
    for (let i = n; i < this.texts.length; i++) this.texts[i]!.visible = false;
  }

  private text(i: number): BitmapText {
    let t = this.texts[i];
    if (!t) {
      t = new BitmapText({ text: 'idle', style: { fontFamily: FONT, fontSize: FONT_SIZE } });
      t.anchor.set(0.5, 1);
      this.texts.push(t);
      this.labels.addChild(t);
    }
    t.visible = true;
    return t;
  }
}
