import { GraphicsContext } from 'pixi.js';
import { INK } from '../combatPalette';
import { Pen } from '../pen';
import { HUB } from './hubPalette';

/**
 * The Hearth's three NPCs as layered shapes in the Loomwright's style (playerShapes.ts): a bell
 * robe, a head with a hat, and what each holds. Local units are cells, (0, 0) the tile center,
 * +y south. Drawn facing +x (east); the view flips them to face the player. Contexts are drawn at
 * pixel scale (×K) and shown at 1/K, so curves stay smooth.
 */
export const K = 24;
const O = 0.3;

export type NpcId = 'spindlewright' | 'runekeeper' | 'cartographer';

export interface NpcShapes {
  shadow: GraphicsContext;
  body: GraphicsContext;
  head: GraphicsContext;
  /** Held item (bobs a little out of step with the body). */
  prop: GraphicsContext;
}

function pen(draw: (p: Pen) => void): GraphicsContext {
  const c = new GraphicsContext();
  draw(new Pen(c, K));
  return c;
}

/** Robe: a bell from the shoulders (y −1.2) to the hem (y 1.5). */
function robe(p: Pen, w: number): Pen {
  return p
    .moveTo(-0.85 * w, -1.25)
    .bez(-1.35 * w, -0.5, -1.7 * w, 0.7, -1.55 * w, 1.3)
    .quad(0, 1.85, 1.55 * w, 1.3)
    .bez(1.7 * w, 0.7, 1.35 * w, -0.5, 0.85 * w, -1.25)
    .quad(0, -1.6, -0.85 * w, -1.25)
    .close();
}

function body(p: Pen, c: { robe: number; shade: number; trim: number }, w = 1): void {
  robe(p, w).fill(c.robe);
  // Cel shade on the far side, away from the upper-left light.
  p.moveTo(0.2 * w, 1.75)
    .quad(1.0 * w, 1.65, 1.55 * w, 1.3)
    .bez(1.7 * w, 0.7, 1.35 * w, -0.5, 0.85 * w, -1.25)
    .quad(1.15 * w, 0.4, 0.2 * w, 1.75)
    .close()
    .fill(c.shade);
  p.moveTo(-1.42 * w, 1.24)
    .quad(0, 1.74, 1.42 * w, 1.24)
    .stroke(0.28, c.trim);
  robe(p, w).stroke(O, INK);
}

function face(p: Pen, skin: number): void {
  p.circle(0, 0, 0.95).fill(skin).stroke(O, INK);
  // Eyes look east (the view flips the figure).
  p.circle(0.18, 0.05, 0.11).fill(INK);
  p.circle(0.55, 0.05, 0.11).fill(INK);
  p.ellipse(0.38, 0.42, 0.16, 0.07).fill({ color: 0xd9735a, alpha: 0.5 });
}

function spindlewright(): NpcShapes {
  const c = HUB.spindlewright;
  return {
    shadow: shadow(1.7),
    body: pen((p) => {
      body(p, c, 1.1);
      // Leather apron with a pocket of spools.
      p.roundRect(-0.85, -0.6, 1.7, 2.1, 0.3).fill(c.hat).stroke(0.16, INK);
      p.rect(-0.55, 0.35, 1.1, 0.55).fill(c.shade).stroke(0.1, INK);
      for (const [x, col] of [
        [-0.32, 0x7f9cff],
        [0, 0xffd166],
        [0.32, 0xff7a6a],
      ] as const)
        p.roundRect(x - 0.12, 0.05, 0.24, 0.42, 0.06).fill(col).stroke(0.07, INK);
    }),
    head: pen((p) => {
      face(p, c.skin);
      // Headscarf knotted at the back, goggles pushed up.
      p.moveTo(-0.98, -0.05).bez(-1.0, -1.2, 1.0, -1.25, 0.98, -0.1).quad(0, -0.45, -0.98, -0.05).close();
      p.fill(c.robe).stroke(O, INK);
      p.circle(-1.05, -0.2, 0.28).fill(c.robe).stroke(0.14, INK);
      p.moveTo(-1.2, -0.05).lineTo(-1.55, 0.35).stroke(0.2, c.shade);
      for (const x of [-0.25, 0.4]) p.circle(x, -0.72, 0.24).fill(0x9fd6ff).stroke(0.12, INK);
      p.moveTo(-0.01, -0.72).lineTo(0.16, -0.72).stroke(0.1, INK);
    }),
    prop: pen((p) => {
      // A spindle with gold thread.
      p.moveTo(0, -1.3).lineTo(0, 1.0).stroke(0.32, INK).moveTo(0, -1.3).lineTo(0, 1.0).stroke(0.16, HUB.woodLight);
      p.ellipse(0, 0.25, 0.42, 0.62).fill(HUB.gold).stroke(0.12, INK);
      for (const y of [0.0, 0.25, 0.5]) p.moveTo(-0.36, y).lineTo(0.36, y - 0.1).stroke(0.06, HUB.goldDark);
      p.moveTo(0.3, 0.6).bez(0.9, 0.9, 0.5, 1.4, 1.1, 1.5).stroke(0.08, HUB.gold);
    }),
  };
}

function runekeeper(): NpcShapes {
  const c = HUB.runekeeper;
  return {
    shadow: shadow(1.6),
    body: pen((p) => {
      body(p, c, 1);
      // A long stole with rune marks.
      p.moveTo(-0.45, -1.2).lineTo(-0.55, 1.55).stroke(0.42, c.trim).moveTo(0.45, -1.2).lineTo(0.55, 1.55).stroke(0.42, c.trim);
      for (const y of [-0.2, 0.5, 1.15]) {
        p.circle(-0.52, y, 0.09).fill(c.shade);
        p.circle(0.52, y + 0.02, 0.09).fill(c.shade);
      }
    }),
    head: pen((p) => {
      face(p, c.skin);
      // A tall soft hood with a leaf tip; a white beard.
      p.moveTo(0.95, -0.05).bez(1.1, -1.2, 0.2, -2.2, -0.6, -2.4).bez(-0.4, -1.8, -1.2, -1.2, -0.98, 0.2).quad(0, -0.7, 0.95, -0.05).close();
      p.fill(c.hat).stroke(O, INK);
      p.circle(-0.62, -2.4, 0.22).fill(c.trim).stroke(0.1, INK);
      p.moveTo(-0.2, 0.55).quad(0.4, 1.55, 0.95, 0.5).quad(0.4, 0.8, -0.2, 0.55).close().fill(0xf4f0e8).stroke(0.14, INK);
    }),
    prop: pen((p) => {
      // A glowing rune stone held in both hands.
      p.circle(0, 0, 1.05).fill({ color: c.trim, alpha: 0.18 });
      p.roundRect(-0.55, -0.6, 1.1, 1.2, 0.35).fill(0x6f6886).stroke(0.14, INK);
      p.moveTo(-0.22, -0.32).lineTo(0.22, 0).lineTo(-0.22, 0.32).stroke(0.14, c.trim);
    }),
  };
}

function cartographer(): NpcShapes {
  const c = HUB.cartographer;
  return {
    shadow: shadow(1.6),
    body: pen((p) => {
      body(p, c, 1);
      // A satchel strap and a brass compass on the belt.
      p.moveTo(-0.75, -1.15).lineTo(0.95, 0.9).stroke(0.26, HUB.woodDark);
      p.roundRect(0.55, 0.65, 0.85, 0.7, 0.16).fill(HUB.wood).stroke(0.12, INK);
      p.circle(-0.35, 0.6, 0.26).fill(HUB.gold).stroke(0.1, INK);
    }),
    head: pen((p) => {
      face(p, c.skin);
      // A wide-brimmed hat with a feather.
      p.ellipse(0, -0.55, 1.65, 0.42).fill(c.hat).stroke(O, INK);
      p.moveTo(-0.75, -0.6).quad(-0.75, -1.65, 0, -1.7).quad(0.75, -1.65, 0.75, -0.6).close().fill(c.hat).stroke(O, INK);
      p.rect(-0.72, -0.95, 1.44, 0.24).fill(c.trim);
      p.moveTo(-0.55, -0.95).bez(-1.1, -1.8, -1.6, -2.0, -1.9, -2.2).stroke(0.2, 0xff8a5c);
    }),
    prop: pen((p) => {
      // A rolled map.
      p.roundRect(-1.1, -0.3, 2.2, 0.6, 0.3).fill(HUB.cloth).stroke(0.14, INK);
      p.ellipse(1.1, 0, 0.18, 0.3).fill(HUB.clothShade).stroke(0.1, INK);
      p.moveTo(-0.3, -0.3).lineTo(-0.3, 0.3).stroke(0.12, 0xb04a3a);
    }),
  };
}

function shadow(w: number): GraphicsContext {
  return pen((p) => p.ellipse(0, 1.45, w, 0.7).fill({ color: 0x000000, alpha: 0.24 }));
}

let cache: Record<NpcId, NpcShapes> | null = null;

/** Built once and shared. */
export function npcShapes(): Record<NpcId, NpcShapes> {
  return (cache ??= { spindlewright: spindlewright(), runekeeper: runekeeper(), cartographer: cartographer() });
}

/** Where each NPC holds its prop, and where its head sits, relative to the tile center. */
export const NPC_POSE: Readonly<Record<NpcId, { headY: number; propX: number; propY: number }>> = {
  spindlewright: { headY: -2.1, propX: 1.35, propY: -0.1 },
  runekeeper: { headY: -2.0, propX: 0.95, propY: 0.1 },
  cartographer: { headY: -2.05, propX: 0.9, propY: -0.05 },
};
