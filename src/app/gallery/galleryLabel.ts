import { Container, Text } from 'pixi.js';

/** A world-space label centered at (x, y): cream text on a dark plate. */
export function label(text: string, x: number, y: number, size = 1.05, color = 0xfff2d6): Container {
  const c = new Container();
  const px = 32;
  const tx = new Text({
    text,
    resolution: 2,
    style: {
      fontFamily: 'Arial, sans-serif',
      fontSize: px,
      fill: color,
      fontWeight: '700',
      stroke: { color: 0x1d1622, width: 7 },
    },
  });
  tx.scale.set((size / px) * 1.25);
  tx.anchor.set(0.5, 0);
  c.addChild(tx);
  c.position.set(x, y);
  return c;
}
