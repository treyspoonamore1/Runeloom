import { GraphicsContext } from 'pixi.js';
import { PLAYER as P } from './palette';

/**
 * Static geometry for the Loomwright, built once and shared. Local units are
 * cells; (0, 0) is the collision center, +y is south (toward the viewer).
 * Animation only moves, rotates and scales these.
 */
export interface PlayerShapes {
  shadow: GraphicsContext;
  cloak: GraphicsContext;
  cloakRim: GraphicsContext;
  hood: GraphicsContext;
  hoodRim: GraphicsContext;
  /** Hood peak pointing +x; rotated to point away from the aim. */
  hoodPeak: GraphicsContext;
  face: GraphicsContext;
  /** Staff pointing +x from the hand. */
  staff: GraphicsContext;
  ghost: GraphicsContext;
}

/** Cloak outline: a bell, narrow at the shoulders, wide at the hem. */
function cloakPath(c: GraphicsContext): GraphicsContext {
  return c
    .moveTo(-0.9, -1.0)
    .bezierCurveTo(-1.35, -0.4, -1.7, 0.6, -1.55, 1.15)
    .quadraticCurveTo(0, 1.75, 1.55, 1.15)
    .bezierCurveTo(1.7, 0.6, 1.35, -0.4, 0.9, -1.0)
    .quadraticCurveTo(0, -1.4, -0.9, -1.0)
    .closePath();
}

export function buildPlayerShapes(): PlayerShapes {
  const shadow = new GraphicsContext().ellipse(0, 1.0, 1.65, 0.8).fill({ color: 0x000000, alpha: 0.24 });

  const cloak = new GraphicsContext();
  cloakPath(cloak).fill(P.cloak);
  // Cel shade on the right side, away from the upper-left light.
  cloak
    .moveTo(0.15, 1.6)
    .quadraticCurveTo(1.0, 1.5, 1.55, 1.15)
    .bezierCurveTo(1.7, 0.6, 1.35, -0.4, 0.9, -1.0)
    .quadraticCurveTo(1.15, 0.3, 0.15, 1.6)
    .closePath()
    .fill(P.cloakShade);
  cloak
    .moveTo(-1.42, 1.08)
    .quadraticCurveTo(0, 1.62, 1.42, 1.08)
    .stroke({ width: 0.3, color: P.trim, cap: 'round' });
  cloakPath(cloak).stroke({ width: P.outline, color: P.ink, join: 'round' });
  cloak.circle(0, -0.95, 0.24).fill(P.trim).stroke({ width: 0.12, color: P.ink });

  const cloakRim = new GraphicsContext();
  cloakPath(cloakRim).stroke({ width: P.outline * 0.75, color: P.iframeRim, join: 'round' });

  const hood = new GraphicsContext()
    .circle(0, 0, P.hoodR)
    .fill(P.hood)
    .arc(0, 0, P.hoodR * 0.72, -2.6, -1.2)
    .stroke({ width: 0.16, color: 0x6d7ddc, cap: 'round' })
    .circle(0, 0, P.hoodR)
    .stroke({ width: P.outline, color: P.ink });

  const hoodRim = new GraphicsContext()
    .circle(0, 0, P.hoodR)
    .stroke({ width: P.outline * 0.75, color: P.iframeRim });

  const hoodPeak = new GraphicsContext()
    .moveTo(0.3, -0.62)
    .quadraticCurveTo(1.25, -0.25, 1.45, 0)
    .quadraticCurveTo(1.25, 0.25, 0.3, 0.62)
    .closePath()
    .fill(P.hood)
    .stroke({ width: P.outline, color: P.ink, join: 'round' });

  const face = new GraphicsContext()
    .ellipse(0, 0, 0.56, 0.5)
    .fill(P.hoodInner)
    .circle(-0.2, 0.04, 0.1)
    .circle(0.2, 0.04, 0.1)
    .fill(P.eye);

  const staff = new GraphicsContext()
    .moveTo(0.2, 0)
    .lineTo(2.55, 0)
    .stroke({ width: 0.26 + P.outline, color: P.ink, cap: 'round' })
    .moveTo(0.2, 0)
    .lineTo(2.55, 0)
    .stroke({ width: 0.26, color: P.staff, cap: 'round' })
    .circle(2.85, 0, 0.42)
    .fill({ color: P.thread, alpha: 0.3 })
    .ellipse(2.25, 0, 0.2, 0.48)
    .fill(P.spindle)
    .stroke({ width: 0.12, color: P.ink })
    .circle(2.85, 0, 0.2)
    .fill(P.thread)
    .stroke({ width: 0.1, color: P.ink })
    .circle(0.55, 0, 0.36)
    .fill(P.cloak)
    .stroke({ width: P.outline * 0.8, color: P.ink });

  const ghost = new GraphicsContext();
  cloakPath(ghost).fill(P.ghost);
  ghost.circle(0, P.hoodY, P.hoodR).fill(P.ghost);

  return { shadow, cloak, cloakRim, hood, hoodRim, hoodPeak, face, staff, ghost };
}
