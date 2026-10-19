/**
 * Moment exhibits: a level up and a boss death (section 'moments'), the player dying and being
 * re-woven at a Loom Stone (section 'moments2'), and a room transition on request. Drives the
 * gallery's fake state and returns the sim events the real game would send.
 */
import type { Container } from 'pixi.js';
import { spawnEnemy, type Enemy, type GameState, type SimEvent } from '../../sim';
import type { EnemyKind } from '../../../data/enemies';
import { label } from './galleryLabel';
import { sectionOrigin, sectionTile, type SectionId } from './galleryRoom';
import { M4_LOOK } from '../../render/bestiary/bestiaryPalette';

export class MomentDirector {
  private section: SectionId = 'beasts';
  private boss: Enemy | null = null;
  private bossDead = false;
  private leveled = false;
  private died = false;
  private respawned = false;
  private fadeAt = -1;
  private readonly roomId: string;

  constructor(
    private readonly state: GameState,
    labels: Container,
  ) {
    this.roomId = state.room.id;
    const o = sectionOrigin('moments');
    labels.addChild(label('Level up', o.x + 20, o.y + 30));
    labels.addChild(label('Boss death (Cinder Warden)', o.x + 56, o.y + 34));
    const m2 = sectionOrigin('moments2');
    labels.addChild(label('Player death, then re-woven at the active Loom Stone', m2.x + 40, m2.y + 4));
  }

  /** A room transition `delay` seconds from now (the fade from black). */
  roomFade(t: number, delay: number): void {
    this.fadeAt = t + delay;
  }

  show(id: SectionId): void {
    this.section = id;
    const s = this.state;
    const p = s.player;
    p.dead = false;
    this.leveled = this.died = this.respawned = false;
    if (s.room.id !== this.roomId) s.room.id = this.roomId;
    this.fadeAt = -1;
    const o = sectionOrigin(id);
    // The player stands in every section as a size reference (center stage in the moments).
    const at =
      id === 'moments' ? [20, 24] : id === 'moments2' ? [24, 30] : id === 'loot' ? [70, 42] : [76, 44];
    p.x = p.prevX = o.x + at[0]!;
    p.y = p.prevY = o.y + at[1]!;
    if (id === 'moments') {
      if (!this.boss || this.bossDead) {
        const b = spawnEnemy(s, 'dummy', o.x + 56, o.y + 24);
        b.kind = 'cinder_warden' as EnemyKind;
        b.radius = M4_LOOK.cinder_warden.radius;
        b.maxLife = 100;
        b.life = 20;
        this.boss = b;
        this.bossDead = false;
      }
    }
  }

  update(t: number, dt: number): SimEvent[] {
    void dt;
    const out: SimEvent[] = [];
    const s = this.state;
    const p = s.player;
    if (this.fadeAt >= 0 && t >= this.fadeAt) {
      this.fadeAt = -1;
      // A different room id is what the cue detector sees on a real transition.
      s.room.id = `${this.roomId}#next`;
    }
    if (this.section === 'moments') {
      if (!this.leveled && t >= 1.9) {
        this.leveled = true;
        s.hero.level += 1;
      }
      const b = this.boss;
      if (b && !this.bossDead && t >= 1.95) {
        this.bossDead = true;
        const i = s.enemies.indexOf(b);
        if (i >= 0) s.enemies.splice(i, 1);
        out.push({
          type: 'death',
          id: b.id,
          kind: b.kind,
          x: b.x,
          y: b.y,
          killerId: 0,
          cause: 'hit',
          shattered: false,
        });
      }
    } else if (this.section === 'moments2') {
      if (!this.died && t >= 0.4) {
        this.died = true;
        p.dead = true;
        out.push({ type: 'playerDeath', x: p.x, y: p.y });
      }
      if (!this.respawned && t >= 1.9) {
        this.respawned = true;
        const tile = sectionTile('moments2');
        p.dead = false;
        p.x = p.prevX = (tile.tx + 16.5) * 4;
        p.y = p.prevY = (tile.ty + 5.5) * 4 + 3;
        out.push({ type: 'playerRespawn', x: p.x, y: p.y });
      }
    }
    return out;
  }
}
