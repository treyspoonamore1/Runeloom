/**
 * Placeholder bodies for the Drowned Foundry's bosses (M8), so the renderer can draw them before
 * their art pass: a body-sized ellipse in a muted Fen color with an ink outline, plus the white
 * hit-flash silhouette. The 8 Fen enemies have real art (fenShapesA/B); the M1 fallback rig draws
 * these until the bosses get theirs.
 */
import type { AtlasEntry } from '../atlas';
import { ENEMY, INK } from '../combatPalette';
import type { Pen } from '../pen';

/** Body radius (cells, as data/enemiesFen.ts) and a muted body color per kind. */
const FEN_LOOK: Readonly<Record<string, { r: number; color: number; accent: number }>> = {
  // The Drowned Foundry's bosses (data/bossesFen.ts); their rift versions draw as these (lookAs).
  bellwether: { r: 4.5, color: 0x8a6a2e, accent: 0xd8b05a },
  glasswater_coil: { r: 5, color: 0xa9d6dc, accent: 0xf5e04a },
};

function body(p: Pen, r: number, fill: number, accent: number | null): void {
  p.ellipse(0, 0, r, r * 0.8)
    .fill(fill)
    .stroke(ENEMY.outline, accent === null ? 0xffffff : INK);
  if (accent !== null) p.ellipse(0, -r * 0.25, r * 0.45, r * 0.3).fill(accent);
}

export function fenPlaceholderEntries(): AtlasEntry[] {
  const out: AtlasEntry[] = [];
  for (const [kind, l] of Object.entries(FEN_LOOK)) {
    const m = l.r + ENEMY.outline;
    out.push({
      name: `${kind}_body`,
      x0: -m,
      y0: -m,
      x1: m,
      y1: m,
      draw: (p) => body(p, l.r, l.color, l.accent),
    });
    out.push({
      name: `${kind}_flash`,
      x0: -m,
      y0: -m,
      x1: m,
      y1: m,
      draw: (p) => body(p, l.r, 0xffffff, null),
    });
  }
  return out;
}
