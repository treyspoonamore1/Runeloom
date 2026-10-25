/**
 * Shared look of the item art (M7.5): the same dark ink outline and round joins as the adventure
 * icons (src/ui/adventure/icons.tsx), on a 32×32 viewBox. Shapes are flat fills with one or two
 * highlights so they read at 24 px.
 */
import type { JSX } from 'preact';

export const INK = '#2a1c1f';
/** The outline every shape uses: 2 units of ink, round joins. */
export const S = {
  stroke: INK,
  'stroke-width': 2,
  'stroke-linejoin': 'round' as const,
  'stroke-linecap': 'round' as const,
};
/** A thinner ink line for inner details (folds, rivets, facets). */
export const S1 = { ...S, 'stroke-width': 1.4 };
/** Highlight strokes: no outline, round caps. */
export const HI = { fill: 'none', 'stroke-linecap': 'round' as const, 'stroke-linejoin': 'round' as const };

export type Shape = () => JSX.Element;

/** A colored line with an ink casing (rope, thread, shafts): ink drawn wider underneath. */
export function Cased(p: { d: string; color: string; w?: number }) {
  const w = p.w ?? 2.6;
  return (
    <>
      <path
        d={p.d}
        fill="none"
        stroke={INK}
        stroke-width={w + 2.4}
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d={p.d}
        fill="none"
        stroke={p.color}
        stroke-width={w}
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </>
  );
}

/** A four-point sparkle centered on (x, y). */
export function Sparkle(p: { x: number; y: number; r?: number; color?: string }) {
  const r = p.r ?? 3;
  const q = r * 0.28;
  const { x, y } = p;
  return (
    <path
      d={`M${x} ${y - r}L${x + q} ${y - q}L${x + r} ${y}L${x + q} ${y + q}L${x} ${y + r}L${x - q} ${y + q}L${x - r} ${y}L${x - q} ${y - q}z`}
      fill={p.color ?? '#fff4c4'}
    />
  );
}
