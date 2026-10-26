/**
 * Placeholder bodies for the M8 Glasswater Fen kinds (CONTENT §5), so the renderer can draw them
 * (and the dev console can spawn them) before the Fen art pass: a body-sized ellipse in a muted
 * Fen color with an ink outline, plus the white hit-flash silhouette. The art pass replaces these
 * with real bodies and rigs; until then the M1 fallback rig draws them.
 */
import type { AtlasEntry } from '../atlas';
import { ENEMY, INK } from '../combatPalette';
import type { Pen } from '../pen';

/** Body radius (cells, as data/enemiesFen.ts) and a muted body color per kind. */
const FEN_LOOK: Readonly<Record<string, { r: number; color: number; accent: number }>> = {
  glasspike: { r: 1.3, color: 0x9fd0cc, accent: 0xe8fbff },
  copperback: { r: 1.8, color: 0xa7603a, accent: 0x5f9f8a },
  spark_heron: { r: 1.6, color: 0x6f7c86, accent: 0x9b7bff },
  slagshell: { r: 2.4, color: 0x3d3230, accent: 0xc0582a },
  sparkfly: { r: 0.7, color: 0x5d6a3e, accent: 0xd8e08a },
  mire_bull: { r: 2.2, color: 0x6b5238, accent: 0xd9c7a0 },
  bellows_toad: { r: 1.8, color: 0x6c8f4c, accent: 0xd9e3a8 },
  bellshell: { r: 2.2, color: 0x9a7432, accent: 0xd8b05a },
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
